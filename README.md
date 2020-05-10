# Rewards Distributor V2
> Orbs PoS V2 release

&nbsp;

## Sub Projects

* `./shared` - TypeScript shared code with all core logic for rewards calcs used by the other projects
* `./rewards-ui` - web-based UI for manual distribution and analysis of rewards
* `./rewards-service` - node.js service for a validator node that distibutes rewards automatically

&nbsp;

## Project: shared

TypeScript shared code with all core logic for rewards calcs used by the other projects

### Install dev environment

* Prerequisites:

  * Node.js (version > 8.1) 
  * npm (version > 5.2)

* Install project:

  ```
  cd shared
  npm install
  ```

* Run tests:

  ```
  npm test
  ```

### Build and deploy

* Compile shared library:

  ```
  npm run build
  ```

### Calculation algorithm overview

- Go over the list of blocks using `divideBlockPeriod` and look for assignments that took place in this timeframe.

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

&nbsp;

## Project: rewards-ui

Web-based UI for manual distribution and analysis of rewards

### Install dev environment

* Prerequisites:

  * Node.js (version > 8.1) 
  * npm (version > 5.2)
  * Install and build shared lib:

    ```
    cd shared
    npm install
    npm run build
    cd ..
    ```

* Install project:

  ```
  cd rewards-ui
  npm install
  ```

* Run tests:

  ```
  npm test
  ```

* Run a local development server:

  ```
  npm start
  ```

### Build and deploy

* Bundle files for production:

  ```
  npm run build
  ```

&nbsp;

## Project: rewards-service