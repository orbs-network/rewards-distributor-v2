import _ from 'lodash';
import BN from 'bn.js';
import { EventData } from 'web3-eth-contract';
import pLimit from 'p-limit';
import Web3 from 'web3';
import { EthereumContractAddresses } from '.';
import { EthereumAdapter } from './ethereum';
import { EventHistory } from './model';
import { normalizeAddress } from './helpers';

const DEFAULT_CONCURRENCY = 5;

// the main external api to populate the data model (synchronize over all event history)
export class HistoryDownloader {
  public history: EventHistory;
  public extraHistoryPerDelegate: { [delegateAddress: string]: EventHistory } = {}; // optional for additional analytics
  public ethereum = new EthereumAdapter();

  constructor(delegateAddress: string, startingBlock: number, private storeExtraHistoryPerDelegate = false) {
    this.history = new EventHistory(normalizeAddress(delegateAddress), startingBlock);
  }

  setEthereumContracts(web3: Web3, ethereumContractAddresses: EthereumContractAddresses) {
    this.ethereum.setContracts(web3, ethereumContractAddresses);
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
    const f0 = !this.storeExtraHistoryPerDelegate ? { addr: this.history.delegateAddress } : undefined;
    const f1 = undefined; // no filter for this event
    const f2 = !this.storeExtraHistoryPerDelegate ? { distributer: this.history.delegateAddress } : undefined;
    requests[0] = limit(() => this.ethereum.readEvents('Delegations', 'DelegatedStakeChanged', fromBlock, toBlock, f0));
    requests[1] = limit(() => this.ethereum.readEvents('Rewards', 'StakingRewardsAssigned', fromBlock, toBlock, f1));
    requests[2] = limit(() => this.ethereum.readEvents('Rewards', 'StakingRewardsDistributed', fromBlock, toBlock, f2));

    const results = await Promise.all(requests);
    const d0 = HistoryDownloader._parseDelegationChangedEvents(results[0], this.history);
    const d1 = HistoryDownloader._parseRewardsAssignedEvents(results[1], this.history);
    const d2 = HistoryDownloader._parseRewardsDistributedEvents(results[2], this.history);

    this.history.lastProcessedBlock = toBlock;

    // parse extra histories for all delegates if required (default no)
    if (this.storeExtraHistoryPerDelegate) {
      this._parseExtraHistoriesPerDelegate(_.union(d0, d1, d2), results, toBlock);
    }

    return this.history.lastProcessedBlock;
  }

  _parseExtraHistoriesPerDelegate(delegates: string[], results: EventData[][], toBlock: number) {
    for (const delegateAddress of delegates) {
      if (!this.extraHistoryPerDelegate[delegateAddress]) {
        this.extraHistoryPerDelegate[delegateAddress] = new EventHistory(delegateAddress, this.history.startingBlock);
      }
      const delegateHistory = this.extraHistoryPerDelegate[delegateAddress];
      HistoryDownloader._parseDelegationChangedEvents(results[0], delegateHistory);
      HistoryDownloader._parseRewardsAssignedEvents(results[1], delegateHistory);
      HistoryDownloader._parseRewardsDistributedEvents(results[2], delegateHistory);
    }
    for (const [, delegateHistory] of Object.entries(this.extraHistoryPerDelegate)) {
      delegateHistory.lastProcessedBlock = toBlock;
    }
  }

  // appends events relevant to the delegate to history, returns all delegates it encountered
  static _parseDelegationChangedEvents(events: EventData[], history: EventHistory): string[] {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      const addr = normalizeAddress(event.returnValues.addr);
      allDelegates[addr] = true;
      if (addr != history.delegateAddress) continue;
      for (let i = 0; i < event.returnValues.delegators.length; i++) {
        history.delegationChangeEvents.push({
          block: event.blockNumber,
          delegatorAddress: normalizeAddress(event.returnValues.delegators[i]),
          newDelegatedStake: new BN(event.returnValues.delegatorTotalStakes[i]),
        });
      }
    }
    return Object.keys(allDelegates);
  }

  // appends events relevant to the delegate to history, returns all delegates it encountered
  static _parseRewardsAssignedEvents(events: EventData[], history: EventHistory) {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      for (let i = 0; i < event.returnValues.assignees.length; i++) {
        const assignee = normalizeAddress(event.returnValues.assignees[i]);
        allDelegates[assignee] = true;
        if (assignee != history.delegateAddress) continue;
        history.assignmentEvents.push({
          block: event.blockNumber,
          amount: new BN(event.returnValues.amounts[i]),
        });
      }
    }
    return Object.keys(allDelegates);
  }

  // appends events relevant to the delegate to history, returns all delegates it encountered
  static _parseRewardsDistributedEvents(events: EventData[], history: EventHistory) {
    const allDelegates: { [delegateAddress: string]: boolean } = {};
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      const distributer = normalizeAddress(event.returnValues.distributer);
      allDelegates[distributer] = true;
      if (distributer != history.delegateAddress) continue;
      const recipientAddresses = [];
      const amounts = [];
      for (let i = 0; i < event.returnValues.to.length; i++) {
        const to = normalizeAddress(event.returnValues.to[i]);
        recipientAddresses.push(to);
        amounts.push(new BN(event.returnValues.amounts[i]));
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
