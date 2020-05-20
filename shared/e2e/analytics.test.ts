import { TestkitDriver, log } from './driver';
import { HistoryDownloader } from '../src';

jest.setTimeout(60000);

describe('analytics', () => {
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
    expect(Object.keys(historyDownloader.extraHistoryPerDelegate).length).toEqual(4 + 7);
    for (const [delegateAddress, delegateHistory] of Object.entries(historyDownloader.extraHistoryPerDelegate)) {
      expect(delegateHistory.delegateAddress).toEqual(delegateAddress);
      expect(delegateHistory.startingBlock).toEqual(0);
      expect(delegateHistory.lastProcessedBlock).toEqual(latestEthereumBlock);
      expect(delegateHistory.committeeChangeEvents.length).toBeGreaterThan(0);
      expect(delegateHistory.delegationChangeEvents.length).toBeGreaterThan(0);
      expect(delegateHistory.delegationChangeEvents[0].delegatorAddress).toEqual(delegateAddress);
    }
  });
});
