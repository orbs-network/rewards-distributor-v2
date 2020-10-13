import { TestEnvironment } from './driver';
import { join } from 'path';
import { sleep } from '../src/helpers';
import {
  deepDataMatcher,
  isPositiveNumber,
  isValidTimeRef,
  isNumber,
  isValidTxHash,
  isValidEthereumAddress,
} from './deep-matcher';
import { inflate15 } from 'rewards-v2/dist/e2e/driver';
import { normalizeAddress } from 'rewards-v2';

jest.setTimeout(5 * 60000);

describe.skip('e2e with docker compose - new distribution', () => {
  const driver = new TestEnvironment(join(__dirname, 'docker-compose.yml'));
  driver.launchServices(3);

  it('downloads history then performs a new distribution', async () => {
    const latestEthereumBlock = await driver.sharedTestkit.getCurrentBlock();
    console.log(`latest ethereum block: ${latestEthereumBlock}`);

    let status: any = {};

    // download history

    while ((status.Payload?.HistoryMaxProcessedBlock ?? 0) < latestEthereumBlock) {
      await sleep(1000);
      status = await driver.catJsonInService('app', '/opt/orbs/status/status.json');
      console.log(`fetching status.json until history reaches ${latestEthereumBlock}..`);
    }
    console.log('status 1:', JSON.stringify(status, null, 2));

    const errors1 = deepDataMatcher(status.Payload, {
      Uptime: isPositiveNumber,
      MemoryBytesUsed: isPositiveNumber,
      HistoryMaxProcessedBlock: latestEthereumBlock,
      LastHistoryFetchTime: isValidTimeRef,
      HistoryTotalAssignmentEvents: 15,
      HistoryTotalDistributionEvents: 0,
      TimeToNextDistribution: isNumber,
      LastDistributions: {
        genesis: {
          StartTime: isValidTimeRef,
          Complete: true,
          NumNonGuardianRecipients: 0,
          TotalNonGuardianAmount: '',
          TotalGuardianAmount: '',
        },
      },
      CurrentContractAddress: {
        contractRegistry: driver.sharedTestkit.getContractRegistryAddress(),
        rewards: isValidEthereumAddress,
        delegations: isValidEthereumAddress,
      },
    });
    expect(errors1).toEqual([]);

    // finish the new distribution

    while ((status.Payload?.HistoryTotalDistributionEvents ?? 0) < 2) {
      await sleep(1000);
      status = await driver.catJsonInService('app', '/opt/orbs/status/status.json');
      console.log(`fetching status.json until 2 distribution transactions are successful..`);
    }
    console.log('status 2:', JSON.stringify(status, null, 2));

    const distributionName = `0-${latestEthereumBlock}`;
    const errors2 = deepDataMatcher(status.Payload, {
      Uptime: isPositiveNumber,
      MemoryBytesUsed: isPositiveNumber,
      HistoryMaxProcessedBlock: isPositiveNumber,
      LastHistoryFetchTime: isValidTimeRef,
      HistoryTotalAssignmentEvents: 17,
      HistoryTotalDistributionEvents: 2,
      TimeToNextDistribution: isPositiveNumber,
      LastDistributions: {
        genesis: {
          StartTime: isValidTimeRef,
          Complete: true,
          NumNonGuardianRecipients: 0,
          TotalNonGuardianAmount: '',
          TotalGuardianAmount: '',
        },
        [distributionName]: {
          StartTime: isValidTimeRef,
          Complete: true,
          NumNonGuardianRecipients: 4,
          TotalNonGuardianAmount: '55231000000000000000',
          TotalGuardianAmount: '181480000000000000000',
        },
      },
      LastTransactions: [
        {
          SendTime: isValidTimeRef,
          GasPriceStrategy: 'discount',
          GasPrice: 24000000000,
          Status: 'successful',
          TxHash: isValidTxHash,
          EthBlock: latestEthereumBlock + 1,
          DistributionName: distributionName,
          TxIndex: 0,
          NumRecipients: 4,
          TotalAmount: '142024000000000000000',
        },
        {
          SendTime: isValidTimeRef,
          GasPriceStrategy: 'discount',
          GasPrice: 24000000000,
          Status: 'successful',
          TxHash: isValidTxHash,
          EthBlock: latestEthereumBlock + 2,
          DistributionName: distributionName,
          TxIndex: 1,
          NumRecipients: 2,
          TotalAmount: '94687000000000000000',
        },
      ],
    });
    expect(errors2).toEqual([]);

    // expectations over new distribution events
    const events = await driver.sharedTestkit.getNewDistributionEvents(latestEthereumBlock + 1);
    expect(events.length).toEqual(2);
    expect(normalizeAddress(events[0].returnValues.distributer)).toEqual(driver.sharedTestkit.delegateAddress);
    expect(events[0].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[0].returnValues).toHaveProperty('toBlock', latestEthereumBlock.toString());
    expect(events[0].returnValues).toHaveProperty('split', '70000');
    expect(events[0].returnValues).toHaveProperty('txIndex', '0');
    expect(events[0].returnValues.amounts).toEqual([
      inflate15(108886).toString(),
      inflate15(16569).toString(),
      inflate15(13808).toString(),
      inflate15(2761).toString(),
    ]);
    expect(normalizeAddress(events[1].returnValues.distributer)).toEqual(driver.sharedTestkit.delegateAddress);
    expect(events[1].returnValues).toHaveProperty('fromBlock', '0');
    expect(events[1].returnValues).toHaveProperty('toBlock', latestEthereumBlock.toString());
    expect(events[1].returnValues).toHaveProperty('split', '70000');
    expect(events[1].returnValues).toHaveProperty('txIndex', '1');
    expect(events[1].returnValues.amounts).toEqual([inflate15(72594).toString(), inflate15(22093).toString()]);
  });
});
