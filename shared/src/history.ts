import _ from 'lodash';
import BN from 'bn.js';
import { EventData, Contract } from 'web3-eth-contract';
import pLimit from 'p-limit';
import Web3 from 'web3';
import { compiledContracts } from '@orbs-network/orbs-ethereum-contracts-v2/release/compiled-contracts';
import { bnZero, bnDivideAsNumber } from './helpers';
import { EthereumContractAddresses } from '.';

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
  recipientAddresses: string[];
  amounts: BN[]; // the amount distributed to the recipient delegator by the delegate in this distribution
  batchFirstBlock: number; // this distribution is part of a batch - where does the batch start
  batchLastBlock: number; // this distribution is part of a batch - where does the batch end
  batchSplit: Split; // the split used for this batch
  batchTxIndex: number; // the batch has multiple distribution transactions - which one is this
}

export interface Split {
  fractionForDelegators: number; // eg. 0.70 to give delegators 70% and keep 30%
}

export class EventHistory {
  public lastProcessedBlock = 0;
  public delegationChangeEvents: DelegationChangeEvent[] = [];
  public committeeChangeEvents: CommitteeChangeEvent[] = [];
  public assignmentEvents: AssignmentEvent[] = [];
  public distributionEvents: DistributionEvent[] = [];
  constructor(public delegateAddress: string, public startingBlock: number) {}
}

const DEFAULT_CONCURRENCY = 5;

export class HistoryDownloader {
  public history: EventHistory;
  public extraHistoryPerDelegate: { [delegateAddress: string]: EventHistory } = {}; // optional for additional analytics
  private ethereumContracts?: {
    Committee: Contract;
    Delegations: Contract;
    StakingRewards: Contract;
  };

  constructor(delegateAddress: string, startingBlock: number, private storeExtraHistoryPerDelegate = false) {
    this.history = new EventHistory(delegateAddress, startingBlock);
  }

  setEthereumContracts(web3: Web3, ethereumContractAddresses: EthereumContractAddresses) {
    // TODO: replace this line with a nicer way to get the abi's
    this.ethereumContracts = {
      Committee: new web3.eth.Contract(compiledContracts.Committee.abi, ethereumContractAddresses.Committee),
      Delegations: new web3.eth.Contract(compiledContracts.Delegations.abi, ethereumContractAddresses.Delegations),
      StakingRewards: new web3.eth.Contract(
        compiledContracts.StakingRewards.abi,
        ethereumContractAddresses.StakingRewards
      ),
    };
  }

  // returns the last processed block number in the new batch
  // if maxBlocksInBatch is too big, exception will be thrown and up to caller to make it smaller
  async processNextBatch(maxBlocksInBatch: number, latestEthereumBlock: number, concurrency?: number): Promise<number> {
    if (!concurrency) {
      concurrency = DEFAULT_CONCURRENCY;
    }

    // TODO: we now support multiple concurrent requests, also look into request batching https://web3js.readthedocs.io/en/v1.2.6/web3.html#batchrequest
    const limit = pLimit(concurrency);
    const fromBlock = this.history.lastProcessedBlock + 1;
    const toBlock = Math.min(this.history.lastProcessedBlock + maxBlocksInBatch, latestEthereumBlock);
    if (toBlock < fromBlock) {
      throw new Error(`Not enough new blocks in network to process another batch.`);
    }

    const requests = [];
    requests[0] = limit(() => this._web3ReadEvents('Committee', 'CommitteeChanged', fromBlock, toBlock));
    requests[1] = limit(() => this._web3ReadEvents('Delegations', 'DelegatedStakeChanged', fromBlock, toBlock));
    requests[2] = limit(() => this._web3ReadEvents('StakingRewards', 'StakingRewardAssigned', fromBlock, toBlock));
    requests[3] = limit(() => this._web3ReadEvents('StakingRewards', 'StakingRewardsDistributed', fromBlock, toBlock));

    const results = await Promise.all(requests);
    const d1 = HistoryDownloader._parseCommitteeChangedEvents(results[0], this.history);
    const d2 = HistoryDownloader._parseDelegationChangedEvents(results[1], this.history);
    const d3 = HistoryDownloader._parseRewardsAssignedEvents(results[2], this.history);
    const d4 = HistoryDownloader._parseRewardsDistributedEvents(results[3], this.history);

    this.history.lastProcessedBlock = toBlock;

    // parse extra histories for all delegates if required (default no)
    if (this.storeExtraHistoryPerDelegate) {
      this._parseExtraHistoriesPerDelegate(_.union(d1, d2, d3, d4), results, toBlock);
    }

    return this.history.lastProcessedBlock;
  }

  _parseExtraHistoriesPerDelegate(delegates: string[], results: EventData[][], toBlock: number) {
    for (const delegateAddress of delegates) {
      if (!this.extraHistoryPerDelegate[delegateAddress]) {
        this.extraHistoryPerDelegate[delegateAddress] = new EventHistory(delegateAddress, this.history.startingBlock);
      }
      const delegateHistory = this.extraHistoryPerDelegate[delegateAddress];
      HistoryDownloader._parseCommitteeChangedEvents(results[0], delegateHistory);
      HistoryDownloader._parseDelegationChangedEvents(results[1], delegateHistory);
      HistoryDownloader._parseRewardsAssignedEvents(results[2], delegateHistory);
      HistoryDownloader._parseRewardsDistributedEvents(results[3], delegateHistory);
    }
    for (const [, delegateHistory] of Object.entries(this.extraHistoryPerDelegate)) {
      delegateHistory.lastProcessedBlock = toBlock;
    }
  }

  // TODO: add support for filters when ready (to optimize)
  async _web3ReadEvents(
    contract: 'Committee' | 'Delegations' | 'StakingRewards',
    event: string,
    fromBlock: number,
    toBlock: number
  ): Promise<EventData[]> {
    if (!this.ethereumContracts) {
      throw new Error(`Ethereum contracts are undefined, did you call setEthereumContracts?`);
    }
    const ethereumContract = this.ethereumContracts[contract];
    const res = await ethereumContract.getPastEvents(event, {
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    return res;
  }

  // appends events to history, returns all delegates it encountered
  static _parseCommitteeChangedEvents(events: EventData[], history: EventHistory): string[] {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      const totalWeight = new BN(0);
      let delegateWeight = new BN(0);
      for (let i = 0; i < event.returnValues.addrs.length; i++) {
        allDelegates[event.returnValues.addrs[i]] = true;
        const weight = new BN(event.returnValues.weights[i]);
        totalWeight.iadd(weight);
        if (event.returnValues.addrs[i].toLowerCase() == history.delegateAddress.toLowerCase()) {
          delegateWeight = weight;
        }
      }
      let newRelativeWeightInCommittee = 0;
      if (totalWeight.gt(bnZero)) {
        newRelativeWeightInCommittee = bnDivideAsNumber(delegateWeight, totalWeight);
      }
      history.committeeChangeEvents.push({
        block: event.blockNumber,
        newRelativeWeightInCommittee: newRelativeWeightInCommittee,
      });
    }
    return Object.keys(allDelegates);
  }

  // appends events to history, returns all delegates it encountered
  static _parseDelegationChangedEvents(events: EventData[], history: EventHistory): string[] {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      allDelegates[event.returnValues.addr] = true;
      if (event.returnValues.addr.toLowerCase() != history.delegateAddress.toLowerCase()) continue;
      for (let i = 0; i < event.returnValues.delegators.length; i++) {
        history.delegationChangeEvents.push({
          block: event.blockNumber,
          delegatorAddress: event.returnValues.delegators[i],
          newDelegatedStake: new BN(event.returnValues.delegatorTotalStakes[i]),
        });
      }
    }
    return Object.keys(allDelegates);
  }

  // appends events to history, returns all delegates it encountered
  static _parseRewardsAssignedEvents(events: EventData[], history: EventHistory) {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      allDelegates[event.returnValues.assignee] = true;
      if (event.returnValues.assignee.toLowerCase() != history.delegateAddress.toLowerCase()) continue;
      history.assignmentEvents.push({
        block: event.blockNumber,
        amount: new BN(event.returnValues.amount),
      });
    }
    return Object.keys(allDelegates);
  }

  // appends events to history, returns all delegates it encountered
  static _parseRewardsDistributedEvents(events: EventData[], history: EventHistory) {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      allDelegates[event.returnValues.distributer] = true;
      if (event.returnValues.distributer.toLowerCase() != history.delegateAddress.toLowerCase()) continue;
      const recipientAddresses = [];
      const amounts = [];
      for (let i = 0; i < event.returnValues.to.length; i++) {
        recipientAddresses.push(event.returnValues.to[i]);
        amounts.push(new BN(event.returnValues.amounts));
      }
      history.distributionEvents.push({
        block: event.blockNumber,
        recipientAddresses: recipientAddresses,
        amounts: amounts,
        batchFirstBlock: parseInt(event.returnValues.fromBlock),
        batchLastBlock: parseInt(event.returnValues.toBlock),
        batchSplit: { fractionForDelegators: parseInt(event.returnValues.split) / 1000 / 100 }, // 70000 = 70% = 0.7
        batchTxIndex: parseInt(event.returnValues.txIndex),
      });
    }
    return Object.keys(allDelegates);
  }

  private autoscaleWindowSize = 0;
  private autoscaleStreak = 0;
  public autoscaleConsecutiveFailures = 0;

  // experimental mode that chooses the maxBlocksInBatch for processNextBatch automatically
  async processNextBatchAutoscale(
    latestEthereumBlock: number,
    {
      concurrency = DEFAULT_CONCURRENCY,
      startWindow = 10000,
      maxWindow = 500000,
      minWindow = 50,
      windowGrowFactor = 2,
      windowGrowAfter = 20,
      windowShrinkFactor = 2,
    }: {
      concurrency?: number; // num of concurrent network requests
      startWindow?: number; // the initial window size (max blocks in batch)
      maxWindow?: number; // max possible window size (since it's autoscaling)
      minWindow?: number; // min possible window size (since it's autoscaling)
      windowGrowFactor?: number; // by how much should the window grow when attempting to grow
      windowGrowAfter?: number; // after how many consecutive successes should we attempt to grow
      windowShrinkFactor?: number; // by how much should the window shrink after a failure
    } = {}
  ): Promise<number> {
    if (this.autoscaleWindowSize == 0) {
      this.autoscaleWindowSize = startWindow;
    }

    try {
      const res = await this.processNextBatch(this.autoscaleWindowSize, latestEthereumBlock, concurrency);
      this.autoscaleStreak++;
      this.autoscaleConsecutiveFailures = 0;
      if (this.autoscaleStreak >= windowGrowAfter) {
        this.autoscaleWindowSize = Math.round(this.autoscaleWindowSize * windowGrowFactor);
        if (this.autoscaleWindowSize > maxWindow) this.autoscaleWindowSize = maxWindow;
        this.autoscaleStreak = 0;
      }
      return res;
    } catch (e) {
      this.autoscaleConsecutiveFailures++;
      this.autoscaleWindowSize = Math.round(this.autoscaleWindowSize / windowShrinkFactor);
      if (this.autoscaleWindowSize < minWindow) this.autoscaleWindowSize = minWindow;
      this.autoscaleStreak = 0;
      throw e;
    }
  }
}

// efficient binary search, returns -1 if not found
export function findLowestClosestIndexToBlock(block: number, events: { block: number }[]): number {
  if (events.length == 0) {
    return -1;
  }
  let left = 0;
  let right = events.length - 1;
  while (events[left].block < block) {
    if (events[right].block < block) {
      return -1;
    }
    let middle = Math.floor((left + right) / 2);
    if (events[middle].block >= block) {
      if (middle == right) middle--;
      right = middle;
    } else {
      if (middle == left) middle++;
      left = middle;
    }
  }
  return left;
}
