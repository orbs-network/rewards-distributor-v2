import { TestkitDriver, log, inflate15 } from './driver';
import { HistoryDownloader, Distribution } from '../src';
import BN from 'bn.js';
import { bnAddZeroes } from '../src/helpers';

jest.setTimeout(60000);

describe('new distribution', () => {
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

  it('starts a new rewards distribution with multiple transactions', async () => {
    log('test started: new distribution');

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

    // sanity that nobody changed the static variable
    expect(Distribution.granularity).toEqual(bnAddZeroes(1, 15));

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
    const { isComplete, txHashes } = await distribution.sendTransactionBatch(3, 1);
    console.log(txHashes);
    expect(isComplete).toEqual(true);

    // expectations over new distribution events
    const events = await driver.getNewDistributionEvents(latestEthereumBlock + 1);
    expect(events.length).toEqual(2);
    expect(events[0].returnValues).toHaveProperty('distributer', driver.delegateAddress);
    expect(events[0].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[0].returnValues).toHaveProperty('toBlock', latestEthereumBlock.toString());
    expect(events[0].returnValues).toHaveProperty('split', '70000');
    expect(events[0].returnValues).toHaveProperty('txIndex', '0');
    expect(events[1].returnValues).toHaveProperty('distributer', driver.delegateAddress);
    expect(events[1].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[1].returnValues).toHaveProperty('toBlock', latestEthereumBlock.toString());
    expect(events[1].returnValues).toHaveProperty('split', '70000');
    expect(events[1].returnValues).toHaveProperty('txIndex', '1');
    expect(events[0].returnValues.amounts.concat(events[1].returnValues.amounts)).toEqual(
      // does not contain the validator itself since amounts jitter slightly
      expect.arrayContaining([
        inflate15(22093).toString(),
        inflate15(16569).toString(),
        inflate15(13808).toString(),
        inflate15(2761).toString(),
      ])
    );
  });
});
