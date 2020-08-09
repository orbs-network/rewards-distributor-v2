import _ from 'lodash';
import Web3 from 'web3';
import BN from 'bn.js';
import { Contract, PastEventOptions, EventData } from 'web3-eth-contract';
import { compiledContracts } from '@orbs-network/orbs-ethereum-contracts-v2/release/compiled-contracts';
import { sleep, DailyStats } from '../helpers';
import { EventName, contractByEventName, getContractTypeName, EventFilter } from './types';
import pThrottle from 'p-throttle';

const CONFIRMATION_POLL_INTERVAL_SECONDS = 5;
const GAS_LIMIT_PER_TX = 10000000; // TODO: improve

export type TxProgressNotification = (progress: number, confirmations: number) => void;

export type TransactionBatch = {
  recipientAddresses: string[];
  amounts: BN[];
  totalAmount: BN;
  txIndex: number;
}[];

export class EthereumAdapter {
  public rewardsContract?: Contract;
  public requestStats = new DailyStats();
  private throttled?: pThrottle.ThrottledFunction<[], void>;

  constructor(public web3: Web3, requestsPerSecondLimit: number) {
    if (requestsPerSecondLimit > 0) {
      this.throttled = pThrottle(() => Promise.resolve(), requestsPerSecondLimit, 1000);
    }
  }

  setRewardsContract(address: string) {
    if (this.rewardsContract?.options.address == address) return;
    const abi = compiledContracts.Rewards.abi;
    this.rewardsContract = new this.web3.eth.Contract(abi, address);
  }

  getContractForEvent(eventName: EventName, address: string): Contract {
    const contractName = contractByEventName(eventName);
    const abi = compiledContracts[getContractTypeName(contractName)].abi;
    return new this.web3.eth.Contract(abi, address);
  }

  // throws error if fails, caller needs to decrease page size if needed
  async getPastEvents(
    eventName: EventName,
    { fromBlock, toBlock }: PastEventOptions,
    contract?: Contract,
    filter?: EventFilter
  ): Promise<EventData[]> {
    if (!contract) return [];
    const options: PastEventOptions = {
      fromBlock: fromBlock,
      toBlock: toBlock,
    };
    if (filter) options.filter = filter;
    if (this.throttled) await this.throttled();
    this.requestStats.add(1);
    return contract.getPastEvents(eventName, options);
  }

  // returns txHashes, but only after numConfirmations is reached
  async sendRewardsTransactionBatch(
    batch: TransactionBatch,
    fromBlock: number,
    toBlock: number,
    splitFractionForDelegators: number,
    senderAddress: string,
    numConfirmations: number,
    confirmationTimeoutSeconds: number,
    progressCallback?: TxProgressNotification
  ): Promise<string[]> {
    if (!this.web3 || !this.rewardsContract) {
      throw new Error(`Ethereum contract 'Rewards' is undefined, did you call setEthereumContracts?`);
    }

    // send all transactions
    const request = new this.web3.BatchRequest();
    const promises: Promise<string>[] = _.map(batch, (txData) => {
      return new Promise((resolve, reject) => {
        if (!this.rewardsContract) {
          return reject(new Error(`Ethereum contract 'Rewards' is undefined, did you call setEthereumContracts?`));
        }
        const tx = this.rewardsContract.methods
          .distributeOrbsTokenStakingRewards(
            txData.totalAmount.toString(), // uint256 totalAmount
            fromBlock, // uint256 fromBlock
            toBlock, // uint256 toBlock
            Math.round(splitFractionForDelegators * 100 * 1000), // uint split
            txData.txIndex, // uint txIndex
            txData.recipientAddresses, // address[] calldata to
            _.map(txData.amounts, (bn) => bn.toString()) // uint256[] calldata amounts
          )
          .send.request(
            {
              from: senderAddress,
              gas: GAS_LIMIT_PER_TX,
            },
            (error: Error, txHash: string) => {
              if (error) reject(error);
              else resolve(txHash);
            }
          );
        request.add(tx);
      });
    });
    request.execute();
    const txHashes = await Promise.all(promises);
    if (numConfirmations == 0) return txHashes;

    // check for confirmations
    const lastTxHash = txHashes[txHashes.length - 1];
    const confirmed = await this.waitForConfirmation(
      lastTxHash,
      numConfirmations,
      confirmationTimeoutSeconds,
      progressCallback
    );

    if (confirmed) return txHashes;
    throw new Error(`Did not receive ${numConfirmations} confirmations before timeout ${confirmationTimeoutSeconds}.`);
  }

  // returns true if confirmations arrived before timeout, false otherwise
  async waitForConfirmation(
    txHash: string,
    numConfirmations: number,
    confirmationTimeoutSeconds: number,
    progressCallback?: TxProgressNotification
  ): Promise<boolean> {
    if (!this.web3) {
      throw new Error(`Ethereum contracts are undefined, did you call setEthereumContracts?`);
    }

    let receipt = null;
    const startTime = new Date().getTime();
    while (new Date().getTime() - startTime < confirmationTimeoutSeconds * 1000) {
      await sleep(CONFIRMATION_POLL_INTERVAL_SECONDS * 1000);
      if (receipt == null) {
        try {
          if (this.throttled) await this.throttled();
          receipt = await this.web3.eth.getTransactionReceipt(txHash);
        } catch (e) {
          // do nothing
        }
      }
      if (receipt != null) {
        const ethereumBlockNum = await this.web3.eth.getBlockNumber();
        const confirmations = ethereumBlockNum - receipt.blockNumber + 1;
        if (progressCallback) {
          progressCallback(Math.min(confirmations / numConfirmations, 1), confirmations);
        }
        if (confirmations >= numConfirmations) {
          return true;
        }
      }
    }
    return false;
  }
}
