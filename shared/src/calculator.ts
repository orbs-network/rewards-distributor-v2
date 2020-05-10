import BN from 'bn.js';
import { EventHistory } from './history';

export interface Split {
  fractionForDelegator: number; // eg. 0.70 to give delegators 70% and keep 30%
}

export interface Division {
  amounts: { [recipientAddress: string]: BN };
}

export function divideSingleAssignment(assignmentEventIndex: number, split: Split, history: EventHistory): Division {
  return {
    amounts: {},
  };
}

export function divideBlockPeriod(
  firstBlock: number,
  lastBlock: number,
  split: Split,
  history: EventHistory
): Division {
  return {
    amounts: {},
  };
}
