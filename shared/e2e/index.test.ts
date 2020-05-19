import { TestkitDriver } from './driver';
import { HistoryDownloader, Distribution } from '../src';
import BN from 'bn.js';

jest.setTimeout(60000);

describe('e2e', () => {
  const driver = new TestkitDriver();

  beforeAll(async () => {
    log('deploying Orbs PoS V2 contracts');
    await driver.deployOrbsV2Contracts();
    log('preparing the scenario');
    await driver.prepareScenario();
  });

  afterAll(async () => {
    await driver.closeConnections();
  });

  it.only('starts a new rewards distribution with multiple transactions', async () => {
    log('test started: starts a new..');

    // get latest ethereum block
    const latestEthereumBlock = await driver.web3.eth.getBlockNumber();
    log(`latest ethereum block: ${latestEthereumBlock}`);

    // create a history downloader
    const historyDownloader = new HistoryDownloader(driver.delegateAddress!, 0);
    historyDownloader.setEthereumContracts(driver.web3, driver.ethereumContractAddresses!);

    // download history up to this block
    let maxProcessedBlock = 0;
    while (maxProcessedBlock < latestEthereumBlock) {
      maxProcessedBlock = await historyDownloader.processNextBatch(100, latestEthereumBlock);
      log(`processed up to block: ${maxProcessedBlock}`);
    }

    // log history result
    console.log(historyDownloader.history);

    // expectations over history result
    expect(historyDownloader.history.delegateAddress).toEqual(driver.delegateAddress);
    expect(historyDownloader.history.startingBlock).toEqual(0);
    expect(historyDownloader.history.lastProcessedBlock).toEqual(latestEthereumBlock);
    expect(historyDownloader.history.committeeChangeEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.delegationChangeEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.delegationChangeEvents[0].delegatorAddress).toEqual(driver.delegateAddress);
    expect(historyDownloader.history.assignmentEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.distributionEvents.length).toEqual(0);

    // create a new distribution of rewards up to this block
    const distribution = Distribution.startNew(
      latestEthereumBlock,
      { fractionForDelegators: 0.7 },
      historyDownloader.history
    );
    distribution.setEthereumContracts(driver.web3, driver.ethereumContractAddresses!);

    // log division result
    console.log(distribution.division);

    // expectations over division result
    const totalAmount = new BN(0);
    for (const [, amount] of Object.entries(distribution.division.amounts)) totalAmount.iadd(amount);
    const balance = await driver.getCurrentRewardBalance(driver.delegateAddress!);
    expect(totalAmount).toEqual(balance);
    expect(Object.keys(distribution.division.amounts).length).toEqual(5);

    // send distribution transactions
    let done = false;
    while (!done) {
      const { isComplete, receipt } = await distribution.sendNextTransaction(3);
      done = isComplete;
      log(`sent distribution transaction: ${receipt!.transactionHash}`);
    }

    // expectations over new distribution events
    const events = await driver.getNewDistributionEvents(latestEthereumBlock + 1);
    expect(events.length).toEqual(1);
    expect(events[0].returnValues).toHaveProperty('distributer', driver.delegateAddress);
    expect(events[0].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[0].returnValues).toHaveProperty('toBlock', latestEthereumBlock.toString());
    expect(events[0].returnValues).toHaveProperty('split', '70000');
    expect(events[0].returnValues).toHaveProperty('txIndex', '0');
    console.log(events[0].returnValues.to);
    console.log(events[0].returnValues.amounts);
  });

  it('downloads extra histories for all delegates for analytics purposes', async () => {
    log('test started: downloads extra..');

    // get latest ethereum block
    const latestEthereumBlock = await driver.web3.eth.getBlockNumber();
    log(`latest ethereum block: ${latestEthereumBlock}`);

    // create a history downloader
    const historyDownloader = new HistoryDownloader(driver.delegateAddress!, 0, true);
    historyDownloader.setEthereumContracts(driver.web3, driver.ethereumContractAddresses!);

    // download history up to this block
    let maxProcessedBlock = 0;
    while (maxProcessedBlock < latestEthereumBlock) {
      maxProcessedBlock = await historyDownloader.processNextBatch(100, latestEthereumBlock);
      log(`processed up to block: ${maxProcessedBlock}`);
    }

    // log history result
    for (const [delegateAddress, delegateHistory] of Object.entries(historyDownloader.extraHistoryPerDelegate)) {
      console.log('delegate', delegateAddress, delegateHistory);
    }

    // expectations over history result
    expect(Object.keys(historyDownloader.extraHistoryPerDelegate).length).toEqual(4);
    for (const [delegateAddress, delegateHistory] of Object.entries(historyDownloader.extraHistoryPerDelegate)) {
      expect(delegateHistory.delegateAddress).toEqual(delegateAddress);
      expect(delegateHistory.startingBlock).toEqual(0);
      expect(delegateHistory.lastProcessedBlock).toEqual(latestEthereumBlock);
      expect(delegateHistory.committeeChangeEvents.length).toBeGreaterThan(0);
      expect(delegateHistory.delegationChangeEvents.length).toBeGreaterThan(0);
      expect(delegateHistory.delegationChangeEvents[0].delegatorAddress).toEqual(delegateAddress);
      expect(delegateHistory.assignmentEvents.length).toBeGreaterThan(0);
      expect(delegateHistory.distributionEvents.length).toEqual(0);
    }
  });
});

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}
