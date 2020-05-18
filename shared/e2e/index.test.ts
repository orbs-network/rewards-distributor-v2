import { TestkitDriver } from './driver';
import { HistoryDownloader } from '../src/history';

jest.setTimeout(60000);

describe('e2e', () => {
  log('Starting e2e..');
  const driver = new TestkitDriver();

  beforeAll(async () => {
    log('Deploying Orbs PoS V2 contracts..');
    await driver.deployOrbsV2Contracts();
    log('Preparing the scenario..');
    await driver.prepareScenario();
    log('Starting actual tests..');
  });

  afterAll(async () => {
    await driver.closeConnections();
  });

  it('distributes rewards with multiple transactions', async () => {
    const latestEthereumBlock = await driver.web3.eth.getBlockNumber();
    log(`Latest ethereum block: ${latestEthereumBlock}`);
    const historyDownloader = new HistoryDownloader(
      driver.delegateAddress!,
      0,
      driver.ethereumContractAddresses,
      driver.web3
    );
    let maxProcessedBlock = 0;
    while (maxProcessedBlock < latestEthereumBlock) {
      maxProcessedBlock = await historyDownloader.processNextBatch(10, latestEthereumBlock);
      log(`Processed up to block: ${maxProcessedBlock}`);
    }
    console.log(historyDownloader.history);
  });
});

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}
