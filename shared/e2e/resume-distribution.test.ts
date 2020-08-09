import { TestkitDriver, log, inflate15 } from './driver';
import { HistoryDownloader, Distribution } from '../src';
import { bnAddZeroes, normalizeAddress } from '../src/helpers';

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
      70000,
      0,
      driver.delegateAddress!,
      [driver.delegateAddress!],
      [inflate15(1000)]
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
    const delegateAddressWeirdCase = driver.delegateAddress!.toUpperCase();
    const historyDownloader = new HistoryDownloader(delegateAddressWeirdCase);
    historyDownloader.setGenesisContract(
      driver.web3,
      driver.getContractRegistryAddress(),
      0,
      {
        initialPageSize: 10,
        maxPageSize: 1000,
        minPageSize: 1,
        pageGrowAfter: 3,
      },
      20
    );

    // download history up to this block
    let maxProcessedBlock = 0;
    while (maxProcessedBlock < latestEthereumBlock) {
      maxProcessedBlock = await historyDownloader.processNextBlock(latestEthereumBlock);
      if (maxProcessedBlock % 100 == 0) log(`processed up to block: ${maxProcessedBlock}`);
    }
    log(`processed up to block: ${maxProcessedBlock}`);

    // log history result
    console.log('history:', JSON.stringify(historyDownloader.history, null, 2));

    // expectations over history result
    expect(historyDownloader.history.delegateAddress).toEqual(driver.delegateAddress);
    expect(historyDownloader.history.startingBlock).toEqual(0);
    expect(historyDownloader.history.lastProcessedBlock).toEqual(latestEthereumBlock);
    expect(historyDownloader.history.contractAddresses).toEqual({
      contractRegistry: driver.getContractRegistryAddress(),
      delegations: driver.getContractAddress('delegations'),
      rewards: driver.getContractAddress('rewards'),
    });
    expect(historyDownloader.history.delegationChangeEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.delegationChangeEvents[0].delegatorAddress).toEqual(driver.delegateAddress);
    expect(historyDownloader.history.assignmentEvents.length).toBeGreaterThan(0);
    expect(historyDownloader.history.distributionEvents.length).toEqual(1);

    // sanity that nobody changed the static variable
    expect(Distribution.granularity).toEqual(bnAddZeroes(1, 15));

    // create a new distribution of rewards up to this block
    const distribution = Distribution.getLastDistribution(latestEthereumBlock, historyDownloader.history);
    if (distribution == null) throw new Error(`distribution is null`);
    distribution.setRewardsContract(driver.web3, historyDownloader.history.contractAddresses.rewards);

    // log division result
    console.log('division:', JSON.stringify(distribution.division, null, 2));

    // expectations over division result
    expect(Object.keys(distribution.division.amountsWithoutDelegate).length).toEqual(4);

    // send distribution transactions
    const batch = distribution.prepareTransactionBatch(10);
    const { isComplete, txHashes } = await distribution.sendTransactionBatch(batch, 1);
    console.log('txHashes:', txHashes);
    expect(isComplete).toEqual(true);

    // expectations over new distribution events
    const events = await driver.getNewDistributionEvents(latestEthereumBlock + 1);
    expect(events.length).toEqual(1);
    expect(normalizeAddress(events[0].returnValues.distributer)).toEqual(driver.delegateAddress);
    expect(events[0].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[0].returnValues).toHaveProperty('toBlock', (latestEthereumBlock - 1).toString());
    expect(events[0].returnValues).toHaveProperty('split', '70000');
    expect(events[0].returnValues).toHaveProperty('txIndex', '1');
    expect(events[0].returnValues.amounts).toEqual([
      inflate15(180480).toString(),
      inflate15(16569).toString(),
      inflate15(13808).toString(),
      inflate15(2761).toString(),
      inflate15(22093).toString(),
    ]);
  });
});
