import { TestkitDriver, log } from './driver';
import { HistoryDownloader } from '../src';

jest.setTimeout(60000);

describe('analytics', () => {
  const driver = new TestkitDriver();
  let startingBlock = -1;

  beforeAll(async () => {
    log('deploying Orbs PoS V2 contracts');
    startingBlock = await driver.getCurrentBlockPreDeploy();
    await driver.deployOrbsV2Contracts();

    log('preparing the scenario');
    await driver.prepareScenario();
  });

  afterAll(async () => {
    await driver.closeConnections();
  });

  it('downloads extra histories for all delegates for analytics purposes', async () => {
    log('test started: analytics');

    // get latest ethereum block
    const latestEthereumBlock = await driver.web3.eth.getBlockNumber();
    log(`latest ethereum block: ${latestEthereumBlock}`);

    // create a history downloader
    const historyDownloader = new HistoryDownloader(driver.delegateAddress!, true);
    historyDownloader.setGenesisContract(driver.web3, driver.getContractRegistryAddress(), startingBlock, {
      initialPageSize: 10,
      maxPageSize: 1000,
      minPageSize: 1,
      pageGrowAfter: 3,
    });

    // download history up to this block
    let maxProcessedBlock = 0;
    while (maxProcessedBlock < latestEthereumBlock) {
      maxProcessedBlock = await historyDownloader.processNextBlock(latestEthereumBlock);
      if (maxProcessedBlock % 100 == 0) log(`processed up to block: ${maxProcessedBlock}`);
    }
    log(`processed up to block: ${maxProcessedBlock}`);

    // log history result
    for (const [delegateAddress, delegateHistory] of Object.entries(historyDownloader.extraHistoryPerDelegate)) {
      console.log('delegate', delegateAddress, delegateHistory);
    }

    // expectations over history result
    expect(Object.keys(historyDownloader.extraHistoryPerDelegate).length).toEqual(4 + 7);
    for (const [delegateAddress, delegateHistory] of Object.entries(historyDownloader.extraHistoryPerDelegate)) {
      expect(delegateHistory.delegateAddress).toEqual(delegateAddress);
      expect(delegateHistory.startingBlock).toEqual(startingBlock);
      expect(delegateHistory.lastProcessedBlock).toEqual(latestEthereumBlock);
      expect(delegateHistory.contractAddresses).toEqual({});
      expect(delegateHistory.delegationChangeEvents.length).toBeGreaterThan(0);
      expect(delegateHistory.delegationChangeEvents[0].delegatorAddress).toEqual(delegateAddress);
    }
  });
});
