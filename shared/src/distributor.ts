import _ from 'lodash';
import { EventHistory, Split } from './history';
import { Division, Calculator } from './calculator';
import BN from 'bn.js';
import { EthereumContractAddresses } from '.';
import { Contract } from 'web3-eth-contract';
import { TransactionReceipt } from 'web3-core';
import { compiledContracts } from '@orbs-network/orbs-ethereum-contracts-v2/release/compiled-contracts';
import Web3 from 'web3';

const DEFAULT_NUM_RECIPIENTS_PER_TX = 10;
const REDUCE_TOO_MANY_RECIPIENTS_BY = 0.8;

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
  private ethereumContracts?: {
    StakingRewards: Contract;
  };

  private constructor(
    public firstBlock: number,
    public lastBlock: number,
    public split: Split,
    private history: EventHistory
  ) {
    this.division = Calculator.divideBlockPeriod(firstBlock, lastBlock, split, history);
  }

  setEthereumContracts(web3: Web3, ethereumContractAddresses: EthereumContractAddresses) {
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

  async sendNextTransaction(
    numRecipientsInTx?: number,
    progressCallback?: TxProgressNotification
  ): Promise<{
    isComplete: boolean;
    receipt?: TransactionReceipt;
  }> {
    if (!numRecipientsInTx) {
      numRecipientsInTx = DEFAULT_NUM_RECIPIENTS_PER_TX;
    }

    const [remaining, maxTxIndex] = this._findRemainingRecipients();
    const allSortedRemainingRecipients = _.sortBy(Object.keys(remaining));
    const allSortedRemainingAmounts = _.map(allSortedRemainingRecipients, (r) => remaining[r]);
    const txIndex = maxTxIndex + 1;

    if (allSortedRemainingRecipients.length == 0) return { isComplete: true };
    if (numRecipientsInTx > allSortedRemainingRecipients.length) {
      numRecipientsInTx = allSortedRemainingRecipients.length;
    }

    while (numRecipientsInTx > 0) {
      const recipientAddresses = _.take(allSortedRemainingRecipients, numRecipientsInTx);
      const amounts = _.take(allSortedRemainingAmounts, numRecipientsInTx);
      try {
        const receipt = await this._web3SendTransaction(recipientAddresses, amounts, txIndex, progressCallback);
        const isComplete = recipientAddresses.length == allSortedRemainingRecipients.length;
        return { isComplete, receipt };
      } catch (e) {
        if (e instanceof TooManyRecipientsError) {
          numRecipientsInTx = Math.floor(numRecipientsInTx * REDUCE_TOO_MANY_RECIPIENTS_BY);
        } else {
          throw e;
        }
      }
    }

    throw new Error(`Cannot send next transaction even after reducing num recipients to zero.`);
  }

  // progress is a for a single transaction and checks confirmations
  async _web3SendTransaction(
    recipientAddresses: string[],
    amounts: BN[],
    txIndex: number,
    progressCallback?: TxProgressNotification
  ): Promise<TransactionReceipt> {
    if (!this.ethereumContracts) {
      throw new Error(`Ethereum contracts are undefined, did you call setEthereumContracts?`);
    }

    const totalAmount = new BN(0);
    for (const amount of amounts) {
      totalAmount.iadd(amount);
    }

    try {
      const receipt = await this.ethereumContracts.StakingRewards.methods
        .distributeOrbsTokenRewards(
          totalAmount.toString(), // uint256 totalAmount
          this.firstBlock, // uint256 fromBlock
          this.lastBlock, // uint256 toBlock
          Math.round(this.split.fractionForDelegators * 100 * 1000), // uint split
          txIndex, // uint txIndex
          recipientAddresses, // address[] calldata to
          _.map(amounts, (bn) => bn.toString()) // uint256[] calldata amounts
        )
        .send({
          from: this.history.delegateAddress,
          gas: 0x7fffffff, // TODO: improve
        });
      return receipt;
    } catch (e) {
      // TODO: catch out of gas and throw TooManyRecipientsError
      console.log(e);
      throw e;
    }
  }
}

export type TxProgressNotification = (progress: number, status: string) => void;

export class TooManyRecipientsError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
