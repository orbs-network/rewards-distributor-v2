import _ from 'lodash';
import { EventHistory, Split } from './history';
import { Division, Calculator } from './calculator';
import BN from 'bn.js';

const DEFAULT_NUM_RECIPIENTS_PER_TX = 10;
const REDUCE_TOO_MANY_RECIPIENTS_BY = 0.8;

export class Distribution {
  // returns the last distribution if exists, null if no distribution done yet
  static getLast(currentBlock: number, history: EventHistory): Distribution | null {
    if (currentBlock > history.lastProcessedBlock) {
      throw new Error(
        `History is not fully synchronized, current block ${currentBlock} last processed ${history.lastProcessedBlock}.`
      );
    }
    if (currentBlock < history.lastProcessedBlock) {
      throw new Error(
        `History, last processed ${history.lastProcessedBlock}, is more advanced than current block ${currentBlock}.`
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
  static startNew(currentBlock: number, split: Split, history: EventHistory): Distribution {
    let firstBlock = 0;
    const lastBlock = currentBlock;
    const lastDistribution = Distribution.getLast(currentBlock, history);
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

  private constructor(
    public firstBlock: number,
    public lastBlock: number,
    public split: Split,
    private history: EventHistory
  ) {
    this.division = Calculator.divideBlockPeriod(firstBlock, lastBlock, split, history);
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
  private _findRemainingRecipients(): { [recipientAddress: string]: BN } {
    const res = _.clone(this.division.amounts);
    for (let index = this.startScanningFromIndex; index < this.history.distributionEvents.length; index++) {
      const event = this.history.distributionEvents[index];
      if (event.batchFirstBlock == this.firstBlock && event.batchLastBlock == this.lastBlock) {
        for (let j = 0; j < event.recipientAddresses.length; j++) {
          delete res[event.recipientAddresses[j]];
        }
      }
    }
    return res;
  }

  isComplete(): boolean {
    const remaining = this._findRemainingRecipients();
    return Object.keys(remaining).length == 0;
  }

  // returns isComplete - false if more transactions need to be sent, true if distribution is finished
  async sendNextTransaction(numRecipientsPerTx: number, progressCallback?: TxProgressNotification): Promise<boolean> {
    if (!numRecipientsPerTx) {
      numRecipientsPerTx = DEFAULT_NUM_RECIPIENTS_PER_TX;
    }

    const remaining = this._findRemainingRecipients();
    const allSortedRecipients = _.sortBy(Object.keys(remaining));
    const allSortedAmounts = _.map(allSortedRecipients, (r) => remaining[r]);
    if (allSortedRecipients.length == 0) return true;
    if (numRecipientsPerTx > allSortedRecipients.length) numRecipientsPerTx = allSortedRecipients.length;

    while (numRecipientsPerTx > 0) {
      const recipientAddresses = _.take(allSortedRecipients, numRecipientsPerTx);
      const amounts = _.take(allSortedAmounts, numRecipientsPerTx);
      try {
        await this._processSendTransactionWithWeb3(recipientAddresses, amounts);
        if (recipientAddresses.length == allSortedRecipients.length) return true;
        else return false;
      } catch (e) {
        if (e instanceof TooManyRecipientsError) {
          numRecipientsPerTx = Math.floor(numRecipientsPerTx * REDUCE_TOO_MANY_RECIPIENTS_BY);
        } else {
          throw e;
        }
      }
    }

    throw new Error(`Cannot send next transaction even after reducing num recipients to zero.`);
  }

  // tries to send multiple times
  async _processSendTransactionWithWeb3(
    recipientAddresses: string[],
    amounts: BN[],
    progressCallback?: TxProgressNotification
  ) {
    // temp just for lint
    await new Promise((resolve) => {
      resolve();
    });
  }
}

export type TxProgressNotification = (progress: number, status: string) => void;

export class TooManyRecipientsError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
