import _ from 'lodash';
import * as Logger from './logger';
import { EventHistory, Split, Division, DistributionEvent } from './model';
import { Calculator } from './calculator';
import BN from 'bn.js';
import { EthereumContractAddresses } from '.';
import Web3 from 'web3';
import { bnAddZeroes } from './helpers';
import { EthereumAdapter, TransactionBatch, TxProgressNotification } from './ethereum';

const DEFAULT_NUM_RECIPIENTS_PER_TX = 10; // without the delegate
const DEFAULT_NUM_CONFIRMATIONS = 4;
const DEFAULT_CONFIRMATION_TIMEOUT_SECONDS = 60 * 10;

// the main external api to distribute rewards
export class Distribution {
  public division: Division; // the division (how much every delegator is owed) that this Distribution distributes
  static granularity = bnAddZeroes(1, 15); // default distribution/assignment granularity used by the contracts
  public ethereum = new EthereumAdapter();
  private startScanningFromIndex = 0; // optimization, the index we can start scanning from to find history events

  // the ctor is private because instantiating a Distribution should only be done through the two static methods below
  private constructor(
    public firstBlock: number,
    public lastBlock: number,
    public split: Split,
    public history: EventHistory
  ) {
    // before we start the actual distribution, calculate the division of how much to give each delegator
    const accurateDivision = Calculator.calcDivisionForBlockPeriod(firstBlock, lastBlock, split, history);
    // we're not allowed to distribute any number, only specific granularity (thousandth of ORBS)
    this.division = Calculator.fixDivisionGranularity(accurateDivision, Distribution.granularity);
  }

  setEthereumContracts(web3: Web3, ethereumContractAddresses: EthereumContractAddresses) {
    this.ethereum.setContracts(web3, ethereumContractAddresses);
  }

  // returns the last distribution if exists, null if no distribution done yet
  // since a distribution contains multiple transactions, it may be stopped in the middle without completing it
  // we must make sure to finish the last one before starting a new one
  static getLastDistribution(latestEthereumBlock: number, history: EventHistory): Distribution | null {
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
    let latestDistributionEvent = history.distributionEvents[index];
    const latestBlock = latestDistributionEvent.block;
    while (index >= 0 && history.distributionEvents[index].block == latestBlock) {
      if (history.distributionEvents[index].batchLastBlock > latestDistributionEvent.batchLastBlock) {
        latestDistributionEvent = history.distributionEvents[index];
      }
      index--;
    }

    Logger.log(
      `Found existing distribution: ${latestDistributionEvent.batchFirstBlock}-${latestDistributionEvent.batchLastBlock} (${latestDistributionEvent.batchSplit.fractionForDelegators}).`
    );

    // return the result
    const res = new Distribution(
      latestDistributionEvent.batchFirstBlock,
      latestDistributionEvent.batchLastBlock,
      latestDistributionEvent.batchSplit,
      history
    );
    res.startScanningFromIndex = res._searchForEarliestEventIndex();
    return res;
  }

  // starts a new distribution assuming there is none in progress and returns it
  // the new distribution takes the block range starting from the end of the last distribution
  // and adding up all the assignments in this block range to calculate a division to distribute
  static startNewDistribution(latestEthereumBlock: number, split: Split, history: EventHistory): Distribution {
    let firstBlock = 0;
    const lastBlock = latestEthereumBlock;
    const lastDistribution = Distribution.getLastDistribution(latestEthereumBlock, history);
    if (lastDistribution != null) {
      if (!lastDistribution.isDistributionComplete()) {
        throw new Error(`There already is a distribution in progress.`);
      }
      firstBlock = lastDistribution.lastBlock + 1;
    }
    if (lastBlock < firstBlock) {
      throw new Error(`When starting new distribution first block ${firstBlock} is higher than current ${lastBlock}.`);
    }

    Logger.log(`Starting new distribution: ${firstBlock}-${lastBlock} (${split.fractionForDelegators}).`);

    // return the result
    const res = new Distribution(firstBlock, lastBlock, split, history);
    res.startScanningFromIndex = history.distributionEvents.length;
    return res;
  }

  // returns earliest index of history.distributionEvents that is relevant for this Distribution
  private _searchForEarliestEventIndex(): number {
    // find the block where tx0 of this distribution is
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

  // return all transactions (distribution events) that were already sent as part of this distribution
  getPreviousTransfers(): DistributionEvent[] {
    const res: DistributionEvent[] = [];
    for (let index = this.startScanningFromIndex; index < this.history.distributionEvents.length; index++) {
      const event = this.history.distributionEvents[index];
      if (event.batchFirstBlock == this.firstBlock && event.batchLastBlock == this.lastBlock) {
        res.push(event);
      }
    }
    return res;
  }

  // returns all delegators (without the delegate) that were not paid yet
  private _findRemainderToDistribute(): DistributionRemainder {
    const resRemainingDelegators = _.clone(this.division.amountsWithoutDelegate);
    const resRemainingAmountForDelegate = this.division.amountForDelegate.clone();
    let resMaxTxIndex = -1;
    const previousEvents = this.getPreviousTransfers();
    for (const event of previousEvents) {
      if (event.recipientAddresses[0] != this.history.delegateAddress) {
        throw new Error(`Corrupt Distribution event ${JSON.stringify(event)} where delegate is not first.`);
      }
      resRemainingAmountForDelegate.isub(event.amounts[0]);
      if (resRemainingAmountForDelegate.isNeg()) {
        throw new Error(`Remaining amount for delegate is negative after event ${JSON.stringify(event)}.`);
      }
      for (let j = 1; j < event.recipientAddresses.length; j++) {
        delete resRemainingDelegators[event.recipientAddresses[j]];
      }
      if (event.batchTxIndex > resMaxTxIndex) {
        resMaxTxIndex = event.batchTxIndex;
      }
    }

    return {
      remainingDelegators: resRemainingDelegators,
      remainingAmountForDelegate: resRemainingAmountForDelegate,
      maxTxIndex: resMaxTxIndex,
    };
  }

  isDistributionComplete(): boolean {
    const remainder = this._findRemainderToDistribute();
    return Object.keys(remainder.remainingDelegators).length == 0 && remainder.remainingAmountForDelegate.isZero();
  }

  prepareTransactionBatch(numRecipientsPerTx?: number): TransactionBatch {
    if (!numRecipientsPerTx) {
      numRecipientsPerTx = DEFAULT_NUM_RECIPIENTS_PER_TX;
    }

    // get the remainder that is left to distribute
    const remainder = this._findRemainderToDistribute();
    const sortedRemainingDelegators = _.sortBy(Object.keys(remainder.remainingDelegators));
    const sortedRemainingDelegatorsAmounts = _.map(sortedRemainingDelegators, (r) => remainder.remainingDelegators[r]);
    const amountLeftSoFarForDelegate = remainder.remainingAmountForDelegate.clone();
    let nextTxIndex = remainder.maxTxIndex + 1; // will be zero for the first (-1+1)

    // make sure we have anything to send
    if (sortedRemainingDelegators.length == 0 && amountLeftSoFarForDelegate.isZero()) return [];

    Logger.log(`Preparing batch based on remainder:\n${JSON.stringify(remainder, null, 2)}`);

    // prepare batch
    const res = [];
    const totalRemainderAmountForDelegators = new BN(0);
    for (const amount of sortedRemainingDelegatorsAmounts) totalRemainderAmountForDelegators.iadd(amount);

    // add delegators in groups
    if (!totalRemainderAmountForDelegators.isZero()) {
      const chunkedDelegatorsAddresses = _.chunk(sortedRemainingDelegators, numRecipientsPerTx);
      const chunkedDelegatorsAmounts = _.chunk(sortedRemainingDelegatorsAmounts, numRecipientsPerTx);
      for (let i = 0; i < chunkedDelegatorsAddresses.length; i++) {
        const totalAmountInTx = new BN(0);
        for (const amount of chunkedDelegatorsAmounts[i]) totalAmountInTx.iadd(amount);
        // the delegate must get some amount in every tx
        const amountInTxForDelegate =
          i == chunkedDelegatorsAddresses.length - 1 // on the last tx
            ? amountLeftSoFarForDelegate.clone() // get everything that's left
            : Calculator.splitAmountInProportionWithGranularity(
                remainder.remainingAmountForDelegate,
                totalAmountInTx,
                totalRemainderAmountForDelegators,
                Distribution.granularity
              );
        // add the tx to the batch
        res.push({
          recipientAddresses: [this.history.delegateAddress, ...chunkedDelegatorsAddresses[i]],
          amounts: [amountInTxForDelegate, ...chunkedDelegatorsAmounts[i]],
          totalAmount: totalAmountInTx.add(amountInTxForDelegate),
          txIndex: nextTxIndex,
        });
        nextTxIndex++;
        amountLeftSoFarForDelegate.isub(amountInTxForDelegate);
      }
    }

    // handle edge cases like zero remaining delegators
    if (!amountLeftSoFarForDelegate.isZero()) {
      res.push({
        recipientAddresses: [this.history.delegateAddress],
        amounts: [amountLeftSoFarForDelegate],
        totalAmount: amountLeftSoFarForDelegate,
        txIndex: nextTxIndex,
      });
    }

    return res;
  }

  async sendTransactionBatch(
    batch: TransactionBatch,
    numConfirmations?: number,
    confirmationTimeoutSeconds?: number,
    progressCallback?: TxProgressNotification
  ): Promise<{
    isComplete: boolean;
    txHashes: string[];
  }> {
    if (!numConfirmations && numConfirmations !== 0) {
      numConfirmations = DEFAULT_NUM_CONFIRMATIONS;
    }
    if (!confirmationTimeoutSeconds) {
      confirmationTimeoutSeconds = DEFAULT_CONFIRMATION_TIMEOUT_SECONDS;
    }

    // make sure we have anything to send
    if (batch.length == 0) return { isComplete: true, txHashes: [] };

    Logger.log(
      `About to send batch: ${this.firstBlock}-${this.lastBlock} (${
        this.split.fractionForDelegators
      }):\n${JSON.stringify(batch, null, 2)}`
    );

    // send the batch with web3
    const txHashes = await this.ethereum.sendRewardsTransactionBatch(
      batch,
      this.firstBlock,
      this.lastBlock,
      this.split.fractionForDelegators,
      this.history.delegateAddress,
      numConfirmations,
      confirmationTimeoutSeconds,
      progressCallback
    );
    const isComplete = numConfirmations > 0 && txHashes.length == batch.length;
    return { isComplete, txHashes };
  }
}

interface DistributionRemainder {
  remainingDelegators: { [recipientAddress: string]: BN };
  remainingAmountForDelegate: BN;
  maxTxIndex: number; // -1 if none found
}
