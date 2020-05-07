import BN from 'bn.js';

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
  recipientAddress: string;
  amount: BN; // the amount distributed to the recipient delegator by the delegate in this distribution
}

export class EventHistory {
  public lastProcessedBlock: number = 0;
  public delegationChangeEvents: DelegationChangeEvent[] = [];
  public committeeChangeEvents: CommitteeChangeEvent[] = [];
  public assignmentEvents: AssignmentEvent[] = [];
  public distributionEvents: DistributionEvent[] = [];
  constructor(public delegateAddress: string) {}
}

export class HistoryDownloader {

  public history: EventHistory;

  constructor(delegateAddress: string, public startingBlock: number) {
    this.history = new EventHistory(delegateAddress);
  }

  // returns the last processed block number in the new batch
  async processNextBatch(maxBlocksInBatch: number): Promise<number> {
    return this.history.lastProcessedBlock;
  }

}