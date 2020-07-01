import _ from 'lodash';
import Web3 from 'web3';
import BN from 'bn.js';
import { EthereumContractAddresses } from '.';
import { EventData, Contract } from 'web3-eth-contract';
import { compiledContracts } from '@orbs-network/orbs-ethereum-contracts-v2/release/compiled-contracts';
import { sleep } from './helpers';

const CONFIRMATION_POLL_INTERVAL_SECONDS = 5;
const GAS_LIMIT_PER_TX = 0x7fffffff; // TODO: improve

export type TxProgressNotification = (progress: number, confirmations: number) => void;

export class EthereumAdapter {
  private web3?: Web3;
  private contracts: {
    Committee?: Contract;
    Delegations?: Contract;
    Rewards?: Contract;
  } = {};

  setContracts(web3: Web3, contractAddresses: EthereumContractAddresses) {
    this.web3 = web3;
    if (contractAddresses.Committee) {
      // TODO: replace this line with a nicer way to get the abi's
      const abi = compiledContracts.Committee.abi;
      this.contracts.Committee = new web3.eth.Contract(abi, contractAddresses.Committee);
    }
    if (contractAddresses.Delegations) {
      const abi = compiledContracts.Delegations.abi;
      this.contracts.Delegations = new web3.eth.Contract(abi, contractAddresses.Delegations);
    }
    if (contractAddresses.Rewards) {
      const abi = compiledContracts.Rewards.abi;
      this.contracts.Rewards = new web3.eth.Contract(abi, contractAddresses.Rewards);
    }
  }

  // TODO: add support for filters when ready (to optimize)
  async readEvents(
    contract: 'Committee' | 'Delegations' | 'Rewards',
    event: string,
    fromBlock: number,
    toBlock: number
  ): Promise<EventData[]> {
    const ethereumContract = this.contracts[contract];
    if (!ethereumContract) {
      throw new Error(`Ethereum contract '${contract}' is undefined, did you call setEthereumContracts?`);
    }
    const res = await ethereumContract.getPastEvents(event, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    return res;
  }

  // returns txHashes, but only after numConfirmations is reached
  async sendRewardsTransactionBatch(
    batch: {
      recipientAddresses: string[];
      amounts: BN[];
      totalAmount: BN;
      txIndex: number;
    }[],
    fromBlock: number,
    toBlock: number,
    splitFractionForDelegators: number,
    senderAddress: string,
    numConfirmations: number,
    confirmationTimeoutSeconds: number,
    progressCallback?: TxProgressNotification
  ): Promise<string[]> {
    if (!this.web3 || !this.contracts.Rewards) {
      throw new Error(`Ethereum contract 'Rewards' is undefined, did you call setEthereumContracts?`);
    }

    // send all transactions
    const request = new this.web3.BatchRequest();
    const promises: Promise<string>[] = _.map(batch, (txData) => {
      return new Promise((resolve, reject) => {
        if (!this.contracts.Rewards) {
          return reject(new Error(`Ethereum contract 'Rewards' is undefined, did you call setEthereumContracts?`));
        }
        const tx = this.contracts.Rewards.methods
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
