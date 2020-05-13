import BN from 'bn.js';
import { EventData } from 'web3-eth-contract';
import pLimit from 'p-limit';

export interface DelegationChangeEvent {
  block: number;
  delegatorAddress: string;
  newDelegatedStake: BN; // total stake of this delegator that is staked towards this delegate
}

export interface CommitteeChangeEvent {
  block: number;
  newRelativeWeightInCommittee: number; // [0,1] if delegate has half the effective stake of the committee then 0.5, if not in committee then 0
}

export interface AssignmentEvent {
  block: number;
  amount: BN; // incoming payment to the delegate by the protocol for distribution
}

export interface DistributionEvent {
  block: number;
  recipientAddresses: string[];
  amounts: BN[]; // the amount distributed to the recipient delegator by the delegate in this distribution
  batchFirstBlock: number; // this distribution is part of a batch - where does the batch start
  batchLastBlock: number; // this distribution is part of a batch - where does the batch end
  batchSplit: Split; // the split used for this batch
  batchTxIndex: number; // the batch has multiple distribution transactions - which one is this
}

export interface Split {
  fractionForDelegators: number; // eg. 0.70 to give delegators 70% and keep 30%
}

export class EventHistory {
  public lastProcessedBlock = 0;
  public delegationChangeEvents: DelegationChangeEvent[] = [];
  public committeeChangeEvents: CommitteeChangeEvent[] = [];
  public assignmentEvents: AssignmentEvent[] = [];
  public distributionEvents: DistributionEvent[] = [];
  constructor(public delegateAddress: string, public startingBlock: number) {}
}

const DEFAULT_CONCURRENCY = 5;

export class HistoryDownloader {
  public history: EventHistory;

  constructor(delegateAddress: string, startingBlock: number) {
    this.history = new EventHistory(delegateAddress, startingBlock);
  }

  // returns the last processed block number in the new batch
  async processNextBatch(maxBlocksInBatch: number, latestEthereumBlock: number, concurrency?: number): Promise<number> {
    if (!concurrency) {
      concurrency = DEFAULT_CONCURRENCY;
    }

    const limit = pLimit(concurrency);
    const fromBlock = this.history.lastProcessedBlock + 1;
    const toBlock = Math.min(this.history.lastProcessedBlock + maxBlocksInBatch, latestEthereumBlock);
    if (toBlock < fromBlock) {
      throw new Error(`Not enough new blocks in network to process another batch.`);
    }

    const requests = [];
    requests[0] = limit(() => this._processReadEventsWithWeb3('C1', 'E1', fromBlock, toBlock));
    requests[1] = limit(() => this._processReadEventsWithWeb3('C2', 'E2', fromBlock, toBlock));
    requests[2] = limit(() => this._processReadEventsWithWeb3('C3', 'E3', fromBlock, toBlock));

    const results = await Promise.all(requests);
    this._parseE1Events(results[0]);
    this._parseE2Events(results[1]);
    this._parseE3Events(results[2]);

    this.history.lastProcessedBlock = toBlock;
    return this.history.lastProcessedBlock;
  }

  async _processReadEventsWithWeb3(
    contract: string,
    event: string,
    fromBlock: number,
    toBlock: number
  ): Promise<EventData[]> {
    // temp just for lint
    await new Promise((resolve) => {
      resolve();
    });
    return [];
  }

  _parseE1Events(events: EventData[]) {
    return [];
  }
  _parseE2Events(events: EventData[]) {
    return [];
  }
  _parseE3Events(events: EventData[]) {
    return [];
  }
}

// efficient binary search, returns -1 if not found
export function findLowestClosestIndexToBlock(block: number, events: { block: number }[]): number {
  if (events.length == 0) {
    return -1;
  }
  let left = 0;
  let right = events.length - 1;
  while (events[left].block < block) {
    if (events[right].block < block) {
      return -1;
    }
    let middle = Math.floor((left + right) / 2);
    if (events[middle].block >= block) {
      if (middle == right) middle--;
      right = middle;
    } else {
      if (middle == left) middle++;
      left = middle;
    }
  }
  return left;
}
