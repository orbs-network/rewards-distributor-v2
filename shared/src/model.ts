import { ContractName } from './ethereum/types';
import BN from 'bn.js';

// the main data model
export class EventHistory {
  public lastProcessedBlock = 0;
  public delegationChangeEvents: DelegationChangeEvent[] = [];
  public assignmentEvents: AssignmentEvent[] = [];
  public distributionEvents: DistributionEvent[] = [];
  public contractAddresses: { [t in ContractName]?: string } = {}; // current, updated to lastProcessedBlock
  public startingBlock = 0;
  constructor(public delegateAddress: string) {}
}

// internal abstracted model to hold delegation events
export interface DelegationChangeEvent {
  block: number;
  delegatorAddress: string;
  newDelegatedStake: BN; // total stake of this delegator that is staked towards this delegate
}

// internal abstracted model to hold assignments events
export interface AssignmentEvent {
  block: number;
  amount: BN; // incoming payment to the delegate by the protocol for distribution
}

// internal abstracted model to hold distribution events
export interface DistributionEvent {
  block: number;
  recipientAddresses: string[]; // first recipient (index 0) is always the delegate
  amounts: BN[]; // the amount distributed to the recipient delegator by the delegate in this distribution
  batchFirstBlock: number; // this distribution is part of a batch - where does the batch start
  batchLastBlock: number; // this distribution is part of a batch - where does the batch end
  batchSplit: Split; // the split used for this batch
  batchTxIndex: number; // the batch has multiple distribution transactions - which one is this
}

export interface Split {
  fractionForDelegators: number; // eg. 0.70 to give delegators 70% and keep 30%
}

// data structure to hold how much every delegator is owed
export interface Division {
  amountsWithoutDelegate: { [recipientAddress: string]: BN };
  amountForDelegate: BN;
}
