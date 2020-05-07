import BN from 'bn.js';
import { EventHistory } from './history';

export interface DelegationsSnapshot {
  stake: { [delegatorAddress: string]: BN }; // total stake of this delegator that is staked towards this delegate
  relativeWeight: { [delegatorAddress: string]: number }; // [0,1] if delegator has half the stake of the delegate then 0.5, if not staking the delegate then 0
}

export class DelegationsAccumulator {

  constructor(private history: EventHistory) {}

  // returns stake and relative weight [0,1] for each delegator
  forBlock(block: number): DelegationsSnapshot {
    return {
      stake: {},
      relativeWeight: {}
    };
  }

}

export class CommitteeAccumulator {

  constructor(private history: EventHistory) {}

  // returns relative weight [0,1] in committee
  forBlock(block: number): number {
    return 0;
  }

}