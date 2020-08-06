import _ from 'lodash';
import BN from 'bn.js';
import { EventData } from 'web3-eth-contract';
import Web3 from 'web3';
import { EthereumAdapter } from './ethereum/ethereum-adapter';
import { EventHistory } from './model';
import { normalizeAddress } from './helpers';
import { EventName, eventNames, contractByEventName } from './ethereum/types';
import { EventFetcher } from './ethereum/event-fetcher';
import { LookaheadEventFetcher, AutoscaleOptions } from './ethereum/event-fetcher-lookahead';

export class HistoryDownloader {
  public history: EventHistory;
  public extraHistoryPerDelegate: { [delegateAddress: string]: EventHistory } = {}; // optional for additional analytics
  public ethereum?: EthereumAdapter;
  private eventFetchers?: { [T in EventName]: EventFetcher };

  constructor(delegateAddress: string, private storeExtraHistoryPerDelegate = false) {
    this.history = new EventHistory(normalizeAddress(delegateAddress));
  }

  setGenesisContract(
    web3: Web3,
    genesisContractAddress: string,
    startingBlock: number,
    autoscale?: Partial<AutoscaleOptions>
  ) {
    this.history.contractAddresses.contractRegistry = genesisContractAddress;
    this.history.startingBlock = startingBlock;
    this.history.lastProcessedBlock = startingBlock;
    this.ethereum = new EthereumAdapter(web3);
    this.eventFetchers = {
      ContractAddressUpdated: new LookaheadEventFetcher('ContractAddressUpdated', this.ethereum, autoscale),
      DelegatedStakeChanged: new LookaheadEventFetcher('DelegatedStakeChanged', this.ethereum, autoscale),
      StakingRewardsAssigned: new LookaheadEventFetcher('StakingRewardsAssigned', this.ethereum, autoscale),
      StakingRewardsDistributed: new LookaheadEventFetcher('StakingRewardsDistributed', this.ethereum, autoscale),
    };
    if (!this.storeExtraHistoryPerDelegate) {
      this.eventFetchers.DelegatedStakeChanged.setFilter({ addr: this.history.delegateAddress });
      this.eventFetchers.StakingRewardsDistributed.setFilter({ distributer: this.history.delegateAddress });
    }
  }

  // returns the last processed block number in the new batch
  async processNextBlock(latestEthereumBlock: number): Promise<number> {
    if (!this.eventFetchers) {
      throw new Error(`Ethereum contract is undefined, did you call setEthereumContract?`);
    }

    const nextBlock = this.history.lastProcessedBlock + 1;
    if (nextBlock > latestEthereumBlock) {
      throw new Error(`Not enough new blocks in network to process another batch.`);
    }

    // Note about tracking changes in contract registry:
    // If contract address was updated in contract registry in the middle of block 1000,
    // we read blocks 1-1000 from old address and blocks 1001+ from the new address.
    // This simplification is ok because contracts will be locked from emitting events during transition.

    // update all contract addresses according to state to track changes in contract registry
    for (const eventName of eventNames) {
      const address = this.history.contractAddresses[contractByEventName(eventName)];
      if (address) this.eventFetchers[eventName].setContractAddress(address);
    }

    // fetch from all event fetchers
    const requests = [];
    requests[0] = this.eventFetchers.ContractAddressUpdated.fetchBlock(nextBlock, latestEthereumBlock);
    requests[1] = this.eventFetchers.DelegatedStakeChanged.fetchBlock(nextBlock, latestEthereumBlock);
    requests[2] = this.eventFetchers.StakingRewardsAssigned.fetchBlock(nextBlock, latestEthereumBlock);
    requests[3] = this.eventFetchers.StakingRewardsDistributed.fetchBlock(nextBlock, latestEthereumBlock);

    const results = await Promise.all(requests);
    HistoryDownloader._parseContractAddressUpdated(results[0], this.history);
    const d1 = HistoryDownloader._parseDelegationChangedEvents(results[1], this.history);
    const d2 = HistoryDownloader._parseRewardsAssignedEvents(results[2], this.history);
    const d3 = HistoryDownloader._parseRewardsDistributedEvents(results[3], this.history);

    this.history.lastProcessedBlock = nextBlock;

    // parse extra histories for all delegates if required (default no)
    if (this.storeExtraHistoryPerDelegate) {
      this._parseExtraHistoriesPerDelegate(_.union(d1, d2, d3), results, nextBlock);
    }

    return this.history.lastProcessedBlock;
  }

  _parseExtraHistoriesPerDelegate(delegates: string[], results: EventData[][], nextBlock: number) {
    for (const delegateAddress of delegates) {
      if (!this.extraHistoryPerDelegate[delegateAddress]) {
        const newHistory = new EventHistory(delegateAddress);
        newHistory.startingBlock = this.history.startingBlock;
        this.extraHistoryPerDelegate[delegateAddress] = newHistory;
      }
      const delegateHistory = this.extraHistoryPerDelegate[delegateAddress];
      HistoryDownloader._parseDelegationChangedEvents(results[1], delegateHistory);
      HistoryDownloader._parseRewardsAssignedEvents(results[2], delegateHistory);
      HistoryDownloader._parseRewardsDistributedEvents(results[3], delegateHistory);
    }
    for (const [, delegateHistory] of Object.entries(this.extraHistoryPerDelegate)) {
      delegateHistory.lastProcessedBlock = nextBlock;
    }
  }

  static _parseContractAddressUpdated(events: EventData[], history: EventHistory) {
    for (const event of events) {
      // for debug: console.log(event.blockNumber, event.returnValues);
      switch (event.returnValues.contractName) {
        case 'delegations':
          history.contractAddresses.delegations = event.returnValues.addr;
          break;
        case 'rewards':
          history.contractAddresses.rewards = event.returnValues.addr;
          break;
      }
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
}
