# Reward Calculation Algorithm

- A distribution is the ceremony where the delegate distributes rewards to delegators. It has multiple transactions.

- Start by checking if the last distribution `getLast` is complete or not. If complete, `startNew`, if not, continue the last one.

- Each distribution is in charge of some block range, they don't overlap and there are no gaps between them.

    * For example: distribution #1 blocks 0-1000, distribution #2 blocks 1001-2200, distribution #3 blocks 2201-2202

- Go over the block range using `divideBlockPeriod` and look for assignments that took place in this timeframe.

- For each assignment, use `divideSingleAssignment` to divide it according to the following:

    - Find all the block numbers relevant to this assignment:

        * First block is one above the block number of the previous assignment.

        * Last block is the block number of this assignment.

    - Assume the total reward rate (to all validators) was constant during this time period.

    - Go over the blocks one by one in the time period and for each block, calculate for each delgator their percentage of the total reward to *all* validators:

        * **Delegator weight in total reward for this block** = **Delegate weight in committee for this block** * **Delegator weight in the delegate for this block**

        * **Delegate weight in committee for this block** = Taken from `CommitteeAccumulator` which accumulates `CommitteeChangeEvent` in the event history.

        * **Delegator weight in the delegate for this block** = Taken from `DelegationsAccumulator` which accumulates `DelegationChangeEvent` in the event history.

    - Deduct the delegate's cut of the assignment according to the split.

    - Sum the **Delegator weight in total reward for this block** across all blocks in the period and this gives the relative weight for the delegator out of the assignment.

- Once the division is known (how much each delegator should receive in this distribution), start distributing with `sendNextTransaction`.

    - The recipients are sorted by address and each one appears in one transaction.

    - Continue sending transactions until the entire sorted list is handled.

- After some time passes, start a new distribution with `startNew`.