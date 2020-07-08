import { TestEnvironment } from './driver';
import { join } from 'path';
import { sleep } from '../src/helpers';
import { deepDataMatcher, isPositiveNumber } from './deep-matcher';

jest.setTimeout(60000);

describe('e2e with docker compose', () => {
  const driver = new TestEnvironment(join(__dirname, 'docker-compose.yml'));
  driver.launchServices();

  it('writes status.json', async () => {
    await sleep(3000);

    const status = await driver.catJsonInService('app', '/opt/orbs/status/status.json');
    console.log('status:', JSON.stringify(status, null, 2));

    const errors = deepDataMatcher(status.Payload, {
      Uptime: isPositiveNumber,
    });
    expect(errors).toEqual([]);
  });
});
