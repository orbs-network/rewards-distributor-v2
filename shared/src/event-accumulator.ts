import BN from 'bn.js';
import { EventHistory } from './model';
import { bnDivideAsNumber, bnZero } from './helpers';

export interface DelegationsSnapshot {
  stake: { [delegatorAddress: string]: BN }; // total stake of this delegator that is staked towards this delegate
  relativeWeight: { [delegatorAddress: string]: number }; // [0,1] if delegator has half the stake of the delegate then 0.5, if not staking the delegate then 0
}

// internal class used by Calculator to do event sourcing
export class DelegationsAccumulator {
  private nextIndex: number;
  private currentState: DelegationsSnapshot; // before applying nextIndex
  private currentBlock: number; // before applying nextIndex

  constructor(private history: EventHistory) {
    this.nextIndex = 0;
    this.currentState = { stake: {}, relativeWeight: {} };
    this.currentBlock = 0;
  }

  // returns stake and relative weight [0,1] for each delegator
  forBlock(block: number): DelegationsSnapshot {
    if (block > this.history.lastProcessedBlock) {
      throw new Error(
        `Trying to access history at block ${block} beyond last processed ${this.history.lastProcessedBlock}.`
      );
    }
    if (block < this.currentBlock) {
      throw new Error(`Trying to go backwards to block ${block} in accumulator that is on block ${this.currentBlock}.`);
    }
    while (this.nextIndex < this.history.delegationChangeEvents.length) {
      const event = this.history.delegationChangeEvents[this.nextIndex];
      if (event.block > block) break;
      const delegatorAddress = event.delegatorAddress;
      if (event.newDelegatedStake.lte(bnZero)) {
        delete this.currentState.stake[delegatorAddress];
        delete this.currentState.relativeWeight[delegatorAddress];
      } else {
        this.currentState.stake[delegatorAddress] = event.newDelegatedStake;
      }
      const sum = new BN(0);
      for (const [, delegatorStake] of Object.entries(this.currentState.stake)) {
        sum.iadd(delegatorStake);
      }
      if (sum.gt(bnZero)) {
        for (const [delegatorAddress, delegatorStake] of Object.entries(this.currentState.stake)) {
          this.currentState.relativeWeight[delegatorAddress] = bnDivideAsNumber(delegatorStake, sum);
        }
      }
      this.currentBlock = event.block;
      this.nextIndex++;
    }
    return this.currentState;
  }
}
