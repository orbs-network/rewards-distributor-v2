import { TestkitDriver } from './driver';
import { HistoryDownloader, Distribution } from '../src';

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

  it('starts a new rewards distribution with multiple transactions', async () => {
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

    console.log(historyDownloader.history);

    // create a new distribution of rewards up to this block
    const distribution = Distribution.startNew(
      latestEthereumBlock,
      { fractionForDelegators: 0.7 },
      historyDownloader.history
    );
    distribution.setEthereumContracts(driver.web3, driver.ethereumContractAddresses!);

    // send distribution transactions
    let done = false;
    while (!done) {
      const { isComplete, receipt } = await distribution.sendNextTransaction(3);
      done = isComplete;
      log(`sent distribution transaction: ${receipt!.transactionHash}`);
    }

    // verify the new distribution events
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
});

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}
