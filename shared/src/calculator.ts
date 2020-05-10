import BN from 'bn.js';
import { EventHistory, findLowestClosestIndexToBlock } from './history';
import { CommitteeAccumulator, DelegationsAccumulator } from './accumulator';
import { multiplyByNumber } from './helpers';

export interface Split {
  fractionForDelegators: number; // eg. 0.70 to give delegators 70% and keep 30%
}

export interface Division {
  amounts: { [recipientAddress: string]: BN };
}

export class Calculator {
  // calls divideSingleAssignment to divide an entire perios of assignments
  static divideBlockPeriod(firstBlock: number, lastBlock: number, split: Split, history: EventHistory): Division {
    if (firstBlock > history.lastProcessedBlock) {
      throw new Error(
        `Trying to access history at first block ${firstBlock} beyond last processed ${history.lastProcessedBlock}.`
      );
    }
    if (lastBlock > history.lastProcessedBlock) {
      throw new Error(
        `Trying to access history at last block ${lastBlock} beyond last processed ${history.lastProcessedBlock}.`
      );
    }
    if (lastBlock < firstBlock) {
      throw new Error(`First block ${firstBlock} is after last block ${lastBlock}.`);
    }
    const res: Division = { amounts: {} };
    const committeeAccumulator = new CommitteeAccumulator(history);
    const delegationsAccumulator = new DelegationsAccumulator(history);
    let index = findLowestClosestIndexToBlock(firstBlock, history.assignmentEvents);
    while (
      index >= 0 &&
      index < history.assignmentEvents.length &&
      history.assignmentEvents[index].block <= lastBlock
    ) {
      const division = Calculator.divideSingleAssignment(
        index,
        split,
        committeeAccumulator,
        delegationsAccumulator,
        history
      );
      // add all the amounts in division to res
      for (const [recipientAddress, amount] of Object.entries(division.amounts)) {
        if (res.amounts[recipientAddress]) {
          res.amounts[recipientAddress].iadd(amount);
        } else {
          res.amounts[recipientAddress] = amount.clone();
        }
      }
      index++;
    }
    return res;
  }

  static divideSingleAssignment(
    assignmentEventIndex: number,
    split: Split,
    committeeAccumulator: CommitteeAccumulator,
    delegationsAccumulator: DelegationsAccumulator,
    history: EventHistory
  ): Division {
    if (assignmentEventIndex < 0 || assignmentEventIndex >= history.assignmentEvents.length) {
      throw new Error(
        `Trying to access assignment event with index ${assignmentEventIndex} when there are ${history.assignmentEvents.length}.`
      );
    }
    if (split.fractionForDelegators < 0 || split.fractionForDelegators > 1) {
      throw new Error(`Illegal split, fraction for delegators is ${split.fractionForDelegators}.`);
    }
    const res: Division = { amounts: {} };
    const sumWeightsOfTotalRewards: { [delegatorAddress: string]: number } = {};

    // step 1: calc the amounts according to the split
    const assignmentAmountForDelegators = multiplyByNumber(
      history.assignmentEvents[assignmentEventIndex].amount,
      split.fractionForDelegators
    );
    const assignmentAmountForDelegate = history.assignmentEvents[assignmentEventIndex].amount.sub(
      assignmentAmountForDelegators
    );

    // step 2: find the blocks we're going to go over
    const firstBlock = findFirstBlockAssignmentPaysFor(assignmentEventIndex, history);
    const lastBlock = findLastBlockAssignmentPaysFor(assignmentEventIndex, history);

    // step 3: for each block sum the weight of each delegator of the total reward for the entire comittee
    for (let block = firstBlock; block <= lastBlock; block++) {
      const delegateWeightInComitteeForBlock = committeeAccumulator.forBlock(block);
      const delegationsSnapshotForBlock = delegationsAccumulator.forBlock(block);
      for (const [delegatorAddress, delegatorWeightInDelegateForBlock] of Object.entries(
        delegationsSnapshotForBlock.relativeWeight
      )) {
        const delegatorWeightInComitteeForBlock = delegatorWeightInDelegateForBlock * delegateWeightInComitteeForBlock;
        if (sumWeightsOfTotalRewards[delegatorAddress]) {
          sumWeightsOfTotalRewards[delegatorAddress] += delegatorWeightInComitteeForBlock;
        } else {
          sumWeightsOfTotalRewards[delegatorAddress] = delegatorWeightInComitteeForBlock;
        }
      }
    }

    // step 4: calc the total weight since it's all relative
    let totalWeight = 0;
    for (const [delegatorAddress, delegatorWeight] of Object.entries(sumWeightsOfTotalRewards)) {
      totalWeight += delegatorWeight;
    }

    // step 5: create the division
    const totalAmountDividedSoFar = new BN(0);
    for (const [delegatorAddress, delegatorWeight] of Object.entries(sumWeightsOfTotalRewards)) {
      if (delegatorAddress == history.delegateAddress) continue; // the entire reminder is given to the delegate
      const delegatorRelativeWeight = delegatorWeight / totalWeight;
      const amountForDelegator = multiplyByNumber(assignmentAmountForDelegators, delegatorRelativeWeight);
      res.amounts[delegatorAddress] = amountForDelegator;
      totalAmountDividedSoFar.iadd(amountForDelegator);
    }

    // step 6: add the reminder and the split to the delegate
    const amountForDelegate = assignmentAmountForDelegators.sub(totalAmountDividedSoFar);
    amountForDelegate.iadd(assignmentAmountForDelegate);
    res.amounts[history.delegateAddress] = amountForDelegate;

    return res;
  }
}

function findFirstBlockAssignmentPaysFor(assignmentEventIndex: number, history: EventHistory): number {
  if (assignmentEventIndex > 0) {
    const accordingToPrev = history.assignmentEvents[assignmentEventIndex - 1].block + 1;
    return Math.min(accordingToPrev, history.assignmentEvents[assignmentEventIndex].block);
  } else {
    return history.startingBlock;
  }
}

function findLastBlockAssignmentPaysFor(assignmentEventIndex: number, history: EventHistory): number {
  return history.assignmentEvents[assignmentEventIndex].block;
}
