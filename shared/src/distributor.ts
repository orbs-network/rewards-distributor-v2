import _ from 'lodash';
import { EventHistory, Split } from './history';
import { Division, Calculator } from './calculator';
import BN from 'bn.js';
import { EthereumContractAddresses } from '.';
import { Contract } from 'web3-eth-contract';
import { compiledContracts } from '@orbs-network/orbs-ethereum-contracts-v2/release/compiled-contracts';
import Web3 from 'web3';
import { sleep } from './helpers';

const DEFAULT_NUM_RECIPIENTS_PER_TX = 10;
const DEFAULT_NUM_CONFIRMATIONS = 4;
const DEFAULT_CONFIRMATION_TIMEOUT_SECONDS = 60 * 10;
const CONFIRMATION_POLL_INTERVAL_SECONDS = 5;
const GAS_LIMIT_PER_TX = 0x7fffffff; // TODO: improve

export class Distribution {
  // returns the last distribution if exists, null if no distribution done yet
  static getLast(latestEthereumBlock: number, history: EventHistory): Distribution | null {
    if (latestEthereumBlock > history.lastProcessedBlock) {
      throw new Error(
        `History is not fully synchronized, current block ${latestEthereumBlock} last processed ${history.lastProcessedBlock}.`
      );
    }
    if (latestEthereumBlock < history.lastProcessedBlock) {
      throw new Error(
        `History, last processed ${history.lastProcessedBlock}, is more advanced than current block ${latestEthereumBlock}.`
      );
    }
    if (history.distributionEvents.length == 0) {
      return null;
    }

    // find latest distribution, handles edge case where we have multiple out of order distributions in one block
    let index = history.distributionEvents.length - 1;
    let latestDistribution = history.distributionEvents[index];
    const latestBlock = latestDistribution.block;
    while (index >= 0 && history.distributionEvents[index].block == latestBlock) {
      if (history.distributionEvents[index].batchLastBlock > latestDistribution.batchLastBlock) {
        latestDistribution = history.distributionEvents[index];
      }
      index--;
    }

    // return the result
    const res = new Distribution(
      latestDistribution.batchFirstBlock,
      latestDistribution.batchLastBlock,
      latestDistribution.batchSplit,
      history
    );
    res.startScanningFromIndex = res._searchForEarliestIndex();
    return res;
  }

  // starts a new distribution assuming there is none in progress and returns it
  static startNew(latestEthereumBlock: number, split: Split, history: EventHistory): Distribution {
    let firstBlock = 0;
    const lastBlock = latestEthereumBlock;
    const lastDistribution = Distribution.getLast(latestEthereumBlock, history);
    if (lastDistribution != null) {
      if (!lastDistribution.isComplete()) {
        throw new Error(`There already is a distribution in progress.`);
      }
      firstBlock = lastDistribution.lastBlock + 1;
    }
    if (lastBlock < firstBlock) {
      throw new Error(`When starting new distribution first block ${firstBlock} is higher than current ${lastBlock}.`);
    }

    // return the result
    const res = new Distribution(firstBlock, lastBlock, split, history);
    res.startScanningFromIndex = history.distributionEvents.length;
    return res;
  }

  public division: Division;
  private startScanningFromIndex = 0; // optimization, the index we can start scanning from to find history events
  private web3?: Web3;
  private ethereumContracts?: {
    StakingRewards: Contract;
  };

  private constructor(
    public firstBlock: number,
    public lastBlock: number,
    public split: Split,
    private history: EventHistory
  ) {
    this.division = Calculator.calcDivisionForBlockPeriod(firstBlock, lastBlock, split, history);
  }

  setEthereumContracts(web3: Web3, ethereumContractAddresses: EthereumContractAddresses) {
    this.web3 = web3;
    // TODO: replace this line with a nicer way to get the abi's
    this.ethereumContracts = {
      StakingRewards: new web3.eth.Contract(
        compiledContracts.StakingRewards.abi,
        ethereumContractAddresses.StakingRewards
      ),
    };
  }

  private _searchForEarliestIndex(): number {
    // find the block where tx0 is
    let index = this.history.distributionEvents.length - 1;
    let earliestBlock = -1;
    while (index >= 0 && earliestBlock == -1) {
      const event = this.history.distributionEvents[index];
      if (
        event.batchFirstBlock == this.firstBlock &&
        event.batchLastBlock == this.lastBlock &&
        event.batchTxIndex == 0
      ) {
        earliestBlock = event.block;
      }
      index--;
    }
    if (earliestBlock == -1) {
      throw new Error(`Could not find tx0 for distribution ${this.firstBlock}:${this.lastBlock}.`);
    }

    // find the earliest index in the block, handles edge case where we have multiple out of order distributions in one block
    index = this.history.distributionEvents.length - 1;
    let res = index;
    while (index >= 0 && this.history.distributionEvents[index].block >= earliestBlock) {
      const event = this.history.distributionEvents[index];
      if (event.block == earliestBlock && index < res) {
        res = index;
      }
      index--;
    }

    return res;
  }

  // returns all recipients that were not paid yet
  private _findRemainingRecipients(): [{ [recipientAddress: string]: BN }, number] {
    const resAmounts = _.clone(this.division.amounts);
    let resMaxTxIndex = -1;
    for (let index = this.startScanningFromIndex; index < this.history.distributionEvents.length; index++) {
      const event = this.history.distributionEvents[index];
      if (event.batchFirstBlock == this.firstBlock && event.batchLastBlock == this.lastBlock) {
        for (let j = 0; j < event.recipientAddresses.length; j++) {
          delete resAmounts[event.recipientAddresses[j]];
        }
        if (event.batchTxIndex > resMaxTxIndex) {
          resMaxTxIndex = event.batchTxIndex;
        }
      }
    }
    return [resAmounts, resMaxTxIndex];
  }

  isComplete(): boolean {
    const [remaining] = this._findRemainingRecipients();
    return Object.keys(remaining).length == 0;
  }

  async sendTransactionBatch(
    numRecipientsInTx?: number,
    numConfirmations?: number,
    confirmationTimeoutSeconds?: number,
    progressCallback?: TxProgressNotification
  ): Promise<{
    isComplete: boolean;
    txHashes: string[];
  }> {
    if (!numRecipientsInTx) {
      numRecipientsInTx = DEFAULT_NUM_RECIPIENTS_PER_TX;
    }
    if (!numConfirmations && numConfirmations !== 0) {
      numConfirmations = DEFAULT_NUM_CONFIRMATIONS;
    }
    if (!confirmationTimeoutSeconds) {
      confirmationTimeoutSeconds = DEFAULT_CONFIRMATION_TIMEOUT_SECONDS;
    }

    const [remaining, maxTxIndex] = this._findRemainingRecipients();
    const allSortedRemainingRecipients = _.sortBy(Object.keys(remaining));
    const allSortedRemainingAmounts = _.map(allSortedRemainingRecipients, (r) => remaining[r]);
    const nextTxIndex = maxTxIndex + 1;

    if (allSortedRemainingRecipients.length == 0) {
      return { isComplete: true, txHashes: [] };
    }

    // prepare batch
    const batch = [];
    const chunkedRecipientAddresses = _.chunk(allSortedRemainingRecipients, numRecipientsInTx);
    const chunkedAmounts = _.chunk(allSortedRemainingAmounts, numRecipientsInTx);
    for (let i = 0; i < chunkedRecipientAddresses.length; i++) {
      const totalAmount = new BN(0);
      for (const amount of chunkedAmounts[i]) {
        totalAmount.iadd(amount);
      }
      batch.push({
        recipientAddresses: chunkedRecipientAddresses[i],
        amounts: chunkedAmounts[i],
        totalAmount: totalAmount,
        txIndex: nextTxIndex + i,
      });
    }

    // send the batch with web3
    const txHashes = await this._web3SendTransactionBatch(
      batch,
      numConfirmations,
      confirmationTimeoutSeconds,
      progressCallback
    );
    const isComplete = numConfirmations > 0 && txHashes.length == batch.length;
    return { isComplete, txHashes };
  }

  // returns txHashes, but only after numConfirmations is reached
  async _web3SendTransactionBatch(
    batch: {
      recipientAddresses: string[];
      amounts: BN[];
      totalAmount: BN;
      txIndex: number;
    }[],
    numConfirmations: number,
    confirmationTimeoutSeconds: number,
    progressCallback?: TxProgressNotification
  ): Promise<string[]> {
    if (!this.web3 || !this.ethereumContracts) {
      throw new Error(`Ethereum contracts are undefined, did you call setEthereumContracts?`);
    }

    // send all transactions
    const request = new this.web3.BatchRequest();
    const promises: Promise<string>[] = _.map(batch, (txData) => {
      return new Promise((resolve, reject) => {
        if (!this.ethereumContracts) {
          return reject(new Error(`Ethereum contracts are undefined, did you call setEthereumContracts?`));
        }
        const tx = this.ethereumContracts.StakingRewards.methods
          .distributeOrbsTokenRewards(
            txData.totalAmount.toString(), // uint256 totalAmount
            this.firstBlock, // uint256 fromBlock
            this.lastBlock, // uint256 toBlock
            Math.round(this.split.fractionForDelegators * 100 * 1000), // uint split
            txData.txIndex, // uint txIndex
            txData.recipientAddresses, // address[] calldata to
            _.map(txData.amounts, (bn) => bn.toString()) // uint256[] calldata amounts
          )
          .send.request(
            {
              from: this.history.delegateAddress,
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
    const confirmed = await this._web3WaitForConfirmation(
      lastTxHash,
      numConfirmations,
      confirmationTimeoutSeconds,
      progressCallback
    );

    if (confirmed) return txHashes;
    throw new Error(`Did not receive ${numConfirmations} confirmations before timeout ${confirmationTimeoutSeconds}.`);
  }

  // returns true if confirmations arrived before timeout, false otherwise
  async _web3WaitForConfirmation(
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
          console.error(receipt);
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

export type TxProgressNotification = (progress: number, confirmations: number) => void;
