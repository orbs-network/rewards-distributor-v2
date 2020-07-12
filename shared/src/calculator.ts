import BN from 'bn.js';
import { EventHistory, Split, Division } from './model';
import { DelegationsAccumulator } from './event-accumulator';
import { bnMultiplyByNumber, findLowestClosestIndexToBlock } from './helpers';

// internal class with static functions used to calculate a division (how much every delegator is owed)
export class Calculator {
  // finds all the blocks relevant for this assignment and based on them calculates the division
  // returns an accurate division ignoring any granularity constraints (see fixDivisionGranularity if needed)
  static calcDivisionForSingleAssignment(
    assignmentEventIndex: number,
    split: Split,
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
    const res: Division = { amountsWithoutDelegate: {}, amountForDelegate: new BN(0) };
    const sumWeightsOfTotalRewards: { [delegatorAddress: string]: number } = {};

    // step 1: calc the amounts according to the split
    const assignmentAfterSplitForDelegators = bnMultiplyByNumber(
      history.assignmentEvents[assignmentEventIndex].amount,
      split.fractionForDelegators
    );
    const assignmentAfterSplitForDelegate = history.assignmentEvents[assignmentEventIndex].amount.sub(
      assignmentAfterSplitForDelegators
    );

    // step 2: find the blocks we're going to go over
    const firstBlock = findFirstBlockAssignmentPaysFor(assignmentEventIndex, history);
    const lastBlock = findLastBlockAssignmentPaysFor(assignmentEventIndex, history);

    // step 3: for each block sum the weight of each delegator of the total reward for the entire comittee
    // we do this step toghether for delegate and delegators
    for (let block = firstBlock; block <= lastBlock; block++) {
      const delegationsSnapshotForBlock = delegationsAccumulator.forBlock(block);
      for (const [delegatorAddress, delegatorWeightInDelegateForBlock] of Object.entries(
        delegationsSnapshotForBlock.relativeWeight
      )) {
        // we used to also multiply here by the delegate weight in the committee but this part was removed
        // leaving the variable names as such for historic reasons
        const delegatorWeightInComitteeForBlock = delegatorWeightInDelegateForBlock;
        if (sumWeightsOfTotalRewards[delegatorAddress]) {
          sumWeightsOfTotalRewards[delegatorAddress] += delegatorWeightInComitteeForBlock;
        } else {
          sumWeightsOfTotalRewards[delegatorAddress] = delegatorWeightInComitteeForBlock;
        }
      }
    }

    // step 4: calc the total weight since it's all relative
    // we do this step toghether for delegate and delegators
    let totalWeight = 0;
    for (const [, delegatorWeight] of Object.entries(sumWeightsOfTotalRewards)) {
      totalWeight += delegatorWeight;
    }

    // step 5: create the division
    const totalAmountDividedSoFar = new BN(0);
    for (const [delegatorAddress, delegatorWeight] of Object.entries(sumWeightsOfTotalRewards)) {
      if (delegatorAddress == history.delegateAddress) continue; // the entire reminder is given to the delegate
      const delegatorRelativeWeight = delegatorWeight / totalWeight;
      const amountForDelegator = bnMultiplyByNumber(assignmentAfterSplitForDelegators, delegatorRelativeWeight);
      res.amountsWithoutDelegate[delegatorAddress] = amountForDelegator;
      totalAmountDividedSoFar.iadd(amountForDelegator);
    }

    // step 6: add the reminder and the split to the delegate
    const amountForDelegate = assignmentAfterSplitForDelegators.sub(totalAmountDividedSoFar); // the part for being a delegator
    amountForDelegate.iadd(assignmentAfterSplitForDelegate); // the part for being a guardian
    res.amountForDelegate = amountForDelegate;

    return res;
  }

  // calls calcDivisionForSingleAssignment on each assignment to divide an entire perios of assignments (adds them up)
  // returns an accurate division ignoring any granularity constraints (see fixDivisionGranularity if needed)
  static calcDivisionForBlockPeriod(
    firstBlock: number,
    lastBlock: number,
    split: Split,
    history: EventHistory
  ): Division {
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
    const res: Division = { amountsWithoutDelegate: {}, amountForDelegate: new BN(0) };
    const delegationsAccumulator = new DelegationsAccumulator(history);
    let index = findLowestClosestIndexToBlock(firstBlock, history.assignmentEvents);
    while (
      index >= 0 &&
      index < history.assignmentEvents.length &&
      history.assignmentEvents[index].block <= lastBlock
    ) {
      const division = Calculator.calcDivisionForSingleAssignment(index, split, delegationsAccumulator, history);
      // add the delegate amount to res
      res.amountForDelegate.iadd(division.amountForDelegate);
      // add all the amounts without delegate in division to res
      for (const [recipientAddress, amount] of Object.entries(division.amountsWithoutDelegate)) {
        if (res.amountsWithoutDelegate[recipientAddress]) {
          res.amountsWithoutDelegate[recipientAddress].iadd(amount);
        } else {
          res.amountsWithoutDelegate[recipientAddress] = amount.clone();
        }
      }
      index++;
    }
    return res;
  }

  // takes an accurate division that does not obey granularity rules and enforces granularity rules
  // any extra residue will all be given to the delegate in the division
  // if the total of the division does not meet granularity constraint, throws an error
  static fixDivisionGranularity(division: Division, granularity: BN): Division {
    const total = new BN(0);
    total.iadd(division.amountForDelegate);
    for (const [, amount] of Object.entries(division.amountsWithoutDelegate)) total.iadd(amount);
    if (!total.umod(granularity).isZero()) {
      throw new Error(`Division total ${total} is not divisible by granularity ${granularity}.`);
    }

    // floor everybody except the delegate
    const totalResidue = new BN(0);
    const res: Division = { amountsWithoutDelegate: {}, amountForDelegate: division.amountForDelegate };
    for (const [recipientAddress, amount] of Object.entries(division.amountsWithoutDelegate)) {
      const residue = amount.umod(granularity);
      res.amountsWithoutDelegate[recipientAddress] = amount.sub(residue);
      totalResidue.iadd(residue);
    }

    // give the residue to the delegate
    res.amountForDelegate.iadd(totalResidue);
    return res;
  }

  static splitAmountInProportionWithGranularity(amount: BN, numerator: BN, denominator: BN, granularity: BN): BN {
    const res = amount.mul(numerator).div(denominator);
    // floor with regards to granularity
    return res.sub(res.umod(granularity));
  }
}

function findFirstBlockAssignmentPaysFor(assignmentEventIndex: number, history: EventHistory): number {
  if (assignmentEventIndex > 0) {
    const accordingToPrev = history.assignmentEvents[assignmentEventIndex - 1].block + 1;
    // mostly to deal with two assignments in the same block
    return Math.min(accordingToPrev, history.assignmentEvents[assignmentEventIndex].block);
  } else {
    return history.startingBlock;
  }
}

function findLastBlockAssignmentPaysFor(assignmentEventIndex: number, history: EventHistory): number {
  return history.assignmentEvents[assignmentEventIndex].block;
}
