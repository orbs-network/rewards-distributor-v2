import { TestEnvironment } from './driver';
import { join } from 'path';
import { sleep } from '../src/helpers';
import { deepDataMatcher, isPositiveNumber, isValidTimeRef } from './deep-matcher';

jest.setTimeout(60000);

describe('e2e with docker compose', () => {
  const driver = new TestEnvironment(join(__dirname, 'docker-compose.yml'));
  driver.launchServices();

  it('downloads history', async () => {
    const latestEthereumBlock = await driver.sharedTestkit.getCurrentBlock();
    console.log(`latest ethereum block: ${latestEthereumBlock}`);

    let status: any = {};

    while ((status.Payload?.HistoryMaxProcessedBlock ?? 0) < latestEthereumBlock) {
      await sleep(1000);
      status = await driver.catJsonInService('app', '/opt/orbs/status/status.json');
      console.log(`fetching status.json until history reaches ${latestEthereumBlock}..`);
    }
    console.log('status:', JSON.stringify(status, null, 2));

    const errors = deepDataMatcher(status.Payload, {
      Uptime: isPositiveNumber,
      MemoryBytesUsed: isPositiveNumber,
      HistoryMaxProcessedBlock: latestEthereumBlock,
      LastHistoryBatchTime: isValidTimeRef,
      HistoryTotalAssignmentEvents: 16,
      HistoryTotalDistributionEvents: 0,
    });
    expect(errors).toEqual([]);
  });
});
