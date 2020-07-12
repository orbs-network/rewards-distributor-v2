import { TestkitDriver, log } from './driver';
import { HistoryDownloader } from '../src';

jest.setTimeout(60000);

describe('autoscale', () => {
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

  it('autoscaling window size when downloads history', async () => {
    log('test started: autoscale');

    // get latest ethereum block
    const latestEthereumBlock = await driver.web3.eth.getBlockNumber();
    log(`latest ethereum block: ${latestEthereumBlock}`);

    // create a history downloader
    const historyDownloader = new HistoryDownloader(driver.delegateAddress!, 0);
    historyDownloader.setEthereumContracts(driver.web3, driver.ethereumContractAddresses!);

    const autoscaleOptions = {
      startWindow: 10,
      maxWindow: 1000,
      minWindow: 1,
      windowGrowAfter: 3,
    };

    // download history up to this block
    let maxProcessedBlock = 0;
    while (maxProcessedBlock < latestEthereumBlock) {
      maxProcessedBlock = await historyDownloader.processNextBatchAutoscale(latestEthereumBlock, autoscaleOptions);
      log(`processed up to block: ${maxProcessedBlock}`);
    }

    // log history result
    console.log('history:', historyDownloader.history);

    // expectations over history result
    expect(historyDownloader.history.delegateAddress).toEqual(driver.delegateAddress);
    expect(historyDownloader.history.startingBlock).toEqual(0);
    expect(historyDownloader.history.lastProcessedBlock).toEqual(latestEthereumBlock);
    expect(historyDownloader.history.delegationChangeEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.delegationChangeEvents[0].delegatorAddress).toEqual(driver.delegateAddress);
    expect(historyDownloader.history.assignmentEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.distributionEvents.length).toEqual(0);
  });
});
