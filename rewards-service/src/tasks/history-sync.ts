import { State } from '../model/state';
import * as Logger from '../logger';
import { HistoryDownloader } from 'rewards-v2';
import Web3 from 'web3';
import { getCurrentClockTime } from '../helpers';

export type HistorySyncConfiguration = {
  EthereumEndpoint: string;
  EthereumDelegationsContract: string;
  EthereumRewardsContract: string;
  GuardianAddress: string;
  EthereumFirstBlock: number;
};

const autoscaleOptions = {
  startWindow: 10000,
  maxWindow: 500000,
  minWindow: 50,
  windowGrowFactor: 2,
  windowGrowAfter: 20,
  windowShrinkFactor: 2,
};

export class HistorySync {
  private web3: Web3;
  private historyDownloader: HistoryDownloader;

  constructor(private state: State, config: HistorySyncConfiguration) {
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.EthereumEndpoint));
    this.historyDownloader = new HistoryDownloader(config.GuardianAddress, config.EthereumFirstBlock);
    this.historyDownloader.setEthereumContracts(this.web3, {
      Delegations: config.EthereumDelegationsContract,
      Rewards: config.EthereumRewardsContract,
    });
    state.HistoryMaxProcessedBlock = config.EthereumFirstBlock;
    Logger.log(`HistorySync: initialized with first block ${state.HistoryMaxProcessedBlock}.`);
  }

  // single tick of the run loop
  async run() {
    // we're going to download history up to this point
    const latestEthereumBlock = await this.web3.eth.getBlockNumber();

    // start downloading
    while (this.state.HistoryMaxProcessedBlock < latestEthereumBlock) {
      try {
        this.state.HistoryMaxProcessedBlock = await this.historyDownloader.processNextBatchAutoscale(
          latestEthereumBlock,
          autoscaleOptions
        );
        this.state.LastHistoryBatchTime = getCurrentClockTime();
        this.state.HistoryTotalAssignmentEvents = this.historyDownloader.history.assignmentEvents.length;
        this.state.HistoryTotalDistributionEvents = this.historyDownloader.history.distributionEvents.length;
        Logger.log(`HistorySync: processed another batch up to ${this.state.HistoryMaxProcessedBlock}.`);
      } catch (e) {
        Logger.error(e.stack);
        if (this.historyDownloader.autoscaleConsecutiveFailures >= 2) {
          console.log(`HistorySync: failing too often, going to sleep for a while.`);
          return;
        }
      }
    }

    // log progress
    Logger.log(`HistorySync: finished processing up to ethereum latest block ${latestEthereumBlock}.`);
  }
}
