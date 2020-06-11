# Reward Calculation Algorithm

## General notes

* The algorithm reads data from Ethereum (where the Orbs PoS contracts are running).

* The algorithm requires to synchornize over several event types from the beginning of history (deployment date of the PoS contracts to Ethereum). This synchronization may take some time and require a stable internet connection.

* The Orbs protocol does not dictate exacly how distribution to delegators should work. Delegates are free to choose any algorithm they believe is fair.

* This algorithm attempts to be very fair and accurate. It's even more accurate than the rewards contract itself on Ethereum which is heavily optimized to keep gas cost low since it runs on-chain. This algorithm runs fully off-chain, so it's able to do heavier calculations and account for more elements in order to be as fair as possible.

## Terminology

* **Delegate** - The address of the guardian/validator that delegators delegate to.

* **Assignment** - A single payment made from the protocol towards the delegate. This payment is not distributed to delegators yet and waits in the delegate's balance until they decide to distribute rewards.

* **Division** - The calculation result of how much each delegator is owed when taking into account multiple assignments.

* **Distribution** - The act of taking a division and actually delivering it to the delegators using multiple transaction batches.

## The algorithm

- A distribution is the ceremony where the delegate distributes rewards to delegators for a certain time period. This ceremony has multiple transactions (payments to different batches of delegators).

- Start by checking if the last distribution ceremony is complete or not using `Distribution.getLast()`. If complete, start a new one with `Distribution.startNew()`. If incomplete, continue the last one.

- Each distribution is in charge of a specific block range. The ranges don't overlap and there are no gaps between them.

    * For example: distribution #1 is for blocks 0-1017, distribution #2 is for blocks 1018-2203, distribution #3 is for blocks 2204-2209. The periods depend mostly on when the delegate has chosen to distribute rewards to their delegators.

- For a specific distribution, go over its block range using `calcDivisionForBlockPeriod()` and look for assignments that took place in this block range (an assignment is a reward payment from the protocol to the delegate that is intended to be distributed).

- For each assignment, use `calcDivisionForSingleAssignment()` to divide it between delegators according to the following:

    - Find all the block numbers in history that are relevant to this assignment:

        * First block is one above the block number of the previous assignment.

        * Last block is the block number of this assignment.

        * Note: the block range for the assignment may be outside of the block period of the distribution, the two periods are not related.

    - Assume the total reward rate (to all validators) was constant during this time period.

    - Go over the blocks one by one (in the time period relevant to the assignment) and for each block, calculate for each delgator their percentage of the total reward to *all* validators:

        * **Delegator weight in total reward for this block** = **Delegate weight in committee for this block** * **Delegator weight in the delegate for this block**

        * **Delegate weight in committee for this block** is taken from `CommitteeAccumulator` which accumulates `CommitteeChangeEvent` in the event history.

        * **Delegator weight in the delegate for this block** is taken from `DelegationsAccumulator` which accumulates `DelegationChangeEvent` in the event history.

    - Deduct the delegate's cut of the assignment according to the declated split. A split for example can be 70% for delegators, 30% for the delegate.

    - Sum the **Delegator weight in total reward for this block** across all blocks in the period and this gives the relative weight for the delegator out of the assignment.

- Once we have the division for each assignment, sum all of the divisions together to get the total division for all assignments together that took place in the distribution block period.

- The Ethereum contracts limit the granularity of distribution to milli-ORBS (1e15). Therefore, the division must be fixed first with `fixDivisionGranularity()` and all amounts are rounded down to this granularity. The delegate receives all the residue.

- Once the total division is known (how much each delegator should receive in this entire distribution), start distributing with `Distribution.sendNextTransaction()`.

    - The recipients are sorted by address and each one appears in exactly one transaction.

    - Continue sending transactions until the entire sorted list is handled.

- Once the delegate decides to distribute again, normally after some time passes, start a new distribution with `Distribution.startNew()`.