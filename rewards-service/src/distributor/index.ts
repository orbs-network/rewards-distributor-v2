import { State } from '../model/state';
import * as Logger from '../logger';
import { HistoryDownloader, Distribution, EthereumContractAddresses } from 'rewards-v2';
import Web3 from 'web3';
import { getCurrentClockTime } from '../helpers';
import { historyAutoscaleOptions, distributionName, distributionStats } from './helpers';
import { toNumber } from '../helpers';
import { sendTransactionBatch, EthereumTxParams } from './send';
import Signer from 'orbs-signer-client';

export type DistributorConfiguration = EthereumTxParams & {
  EthereumEndpoint: string;
  EthereumDelegationsContract: string;
  EthereumRewardsContract: string;
  GuardianAddress: string;
  EthereumFirstBlock: number;
  DistributionFrequencySeconds: number;
  RewardFractionForDelegators: number;
  MaxRecipientsPerRewardsTx: number;
};

export class Distributor {
  public web3: Web3;
  private signer: Signer;
  private historyDownloader: HistoryDownloader;
  private contractAddresses: EthereumContractAddresses;
  private split: { fractionForDelegators: number };

  constructor(private state: State, private config: DistributorConfiguration) {
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.EthereumEndpoint));
    this.signer = new Signer(config.SignerEndpoint);
    this.contractAddresses = {
      Delegations: config.EthereumDelegationsContract,
      Rewards: config.EthereumRewardsContract,
    };
    this.split = { fractionForDelegators: config.RewardFractionForDelegators };
    this.historyDownloader = new HistoryDownloader(config.GuardianAddress, config.EthereumFirstBlock);
    this.historyDownloader.setEthereumContracts(this.web3, this.contractAddresses);
    state.EventHistory = this.historyDownloader.history;
    state.HistoryMaxProcessedBlock = config.EthereumFirstBlock;
    Logger.log(`Distributor: initialized with first block ${state.HistoryMaxProcessedBlock}.`);
  }

  // single tick of the run loop
  async run() {
    // we're going to sync up to this point
    const latestEthereumBlock = await this.web3.eth.getBlockNumber();

    // start by downloading history (syncing events)
    while (this.state.HistoryMaxProcessedBlock < latestEthereumBlock) {
      try {
        this.state.HistoryMaxProcessedBlock = await this.historyDownloader.processNextBatchAutoscale(
          latestEthereumBlock,
          historyAutoscaleOptions
        );
        this.state.LastHistoryBatchTime = getCurrentClockTime();
        Logger.log(`Distributor: processed history batch up to ${this.state.HistoryMaxProcessedBlock}.`);
      } catch (err) {
        Logger.error(err.stack);
        if (this.historyDownloader.autoscaleConsecutiveFailures >= 3) {
          Logger.log(`Distributor: history failing too often, going to sleep for a while.`);
          return;
        }
      }
    }

    // log progress
    Logger.log(`Distributor: history finished catching up to ethereum latest block ${latestEthereumBlock}.`);

    // get info about the last distribution
    const lastDistribution = Distribution.getLastDistribution(latestEthereumBlock, this.historyDownloader.history);
    const lastDistributionStartTime = await this.getDistributionStartTime(lastDistribution);
    const lastDistributionComplete = lastDistribution?.isDistributionComplete() ?? true;
    const lastDistributionName = distributionName(lastDistribution);
    this.state.LastDistributions[lastDistributionName] = distributionStats(
      lastDistribution,
      lastDistributionStartTime,
      lastDistributionComplete
    );
    if (lastDistributionComplete) this.state.InProgressDistribution = undefined;

    // see if we have an active distribution that was not completed
    if (lastDistribution != null && !lastDistributionComplete) {
      Logger.log(`Distributor: found distribution ${lastDistributionName} that is active and incomplete.`);
      await this.completeDistribution(lastDistribution);
      return;
    }

    // no active incomplete distributions, is it time to start a new one?
    const now = getCurrentClockTime();
    this.state.TimeToNextDistribution = this.config.DistributionFrequencySeconds - (now - lastDistributionStartTime);
    if (this.state.TimeToNextDistribution < 0) this.state.TimeToNextDistribution = 0;
    if (this.state.TimeToNextDistribution == 0) {
      const newDistribution = Distribution.startNewDistribution(
        latestEthereumBlock,
        this.split,
        this.historyDownloader.history
      );
      const newDistributionName = distributionName(newDistribution);
      Logger.log(
        `Distributor: starting new distribution ${newDistributionName} since ${lastDistributionName} started on ${lastDistributionStartTime}.`
      );
      await this.completeDistribution(newDistribution);
      return;
    }
  }

  // returns UTC seconds
  async getDistributionStartTime(distribution: Distribution | null): Promise<number> {
    // this operation is a little expensive so cache it
    const distName = distributionName(distribution);
    const cachedResponse = this.state.LastDistributions[distName];
    if (cachedResponse) return cachedResponse.StartTime;

    // start by finding out the block number of the first transfer in the distribution
    let firstTxBlock = this.config.EthereumFirstBlock; // init with genesis in case distribution is null
    if (distribution != null) {
      const transfers = distribution.getPreviousTransfers();
      if (transfers.length == 0) {
        throw new Error(`Trying to get time of empty distribution ${distName}.`);
      }
      firstTxBlock = transfers[0].block;
    }

    // convert block number to time
    const block = await this.web3.eth.getBlock(firstTxBlock);
    if (!block) {
      throw new Error(`Cannot get time of block ${firstTxBlock} belonging to ${distName}.`);
    }
    const res = toNumber(block.timestamp);
    return res;
  }

  async completeDistribution(distribution: Distribution) {
    this.state.InProgressDistribution = distributionStats(distribution, getCurrentClockTime(), false);
    distribution.setEthereumContracts(this.web3, this.contractAddresses);
    const batch = distribution.prepareTransactionBatch(this.config.MaxRecipientsPerRewardsTx);
    await sendTransactionBatch(batch, distribution, this.signer, this.state, this.config);
  }
}
