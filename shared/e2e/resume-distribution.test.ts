import { TestkitDriver, log } from './driver';
import { HistoryDownloader, Distribution } from '../src';
import BN from 'bn.js';

jest.setTimeout(60000);

describe('resume distribution', () => {
  const driver = new TestkitDriver();

  beforeAll(async () => {
    log('deploying Orbs PoS V2 contracts');
    await driver.deployOrbsV2Contracts();

    log('preparing the scenario');
    await driver.prepareScenario();
    // start a distribution that will need to be resumed during the test
    await driver.addManualDistributionEvent(
      0,
      await driver.web3.eth.getBlockNumber(),
      60000,
      0,
      driver.delegateAddress!,
      driver.delegateAddress!,
      new BN(1000)
    );
  });

  afterAll(async () => {
    await driver.closeConnections();
  });

  it('resumes an existing rewards distribution with multiple transactions', async () => {
    log('test started: resume distribution');

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
    expect(historyDownloader.history.distributionEvents.length).toEqual(1);

    // create a new distribution of rewards up to this block
    const distribution = Distribution.getLast(latestEthereumBlock, historyDownloader.history);
    if (distribution == null) throw new Error(`distribution is null`);
    distribution.setEthereumContracts(driver.web3, driver.ethereumContractAddresses!);

    // log division result
    console.log(distribution.division);

    // expectations over division result
    expect(Object.keys(distribution.division.amounts).length).toEqual(5);

    // send distribution transactions
    const { isComplete, txHashes } = await distribution.sendTransactionBatch(10, 1);
    console.log(txHashes);
    expect(isComplete).toEqual(true);

    // expectations over new distribution events
    const events = await driver.getNewDistributionEvents(latestEthereumBlock + 1);
    expect(events.length).toEqual(1);
    expect(events[0].returnValues).toHaveProperty('distributer', driver.delegateAddress);
    expect(events[0].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[0].returnValues).toHaveProperty('toBlock', (latestEthereumBlock - 1).toString());
    expect(events[0].returnValues).toHaveProperty('split', '60000');
    expect(events[0].returnValues).toHaveProperty('txIndex', '1');
    expect(events[0].returnValues.amounts).toEqual(
      // does not contain the validator itself since amounts jitter slightly
      expect.arrayContaining(['12611', '9767', '1993', '598'])
    );
  });
});
