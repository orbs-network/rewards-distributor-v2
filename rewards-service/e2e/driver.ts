import { TestkitDriver } from 'rewards-v2/dist/e2e/driver';
import { dockerComposeTool, getAddressForService, getLogsForService } from 'docker-compose-mocha';
import { retry } from 'ts-retry-promise';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import Web3 from 'web3';
import HDWalletProvider from 'truffle-hdwallet-provider';
import { exec } from 'child_process';
import { exec as execPromise } from 'child-process-promise';
import { sleep } from '../src/helpers';

export class TestEnvironment {
  private envName: string = '';
  public sharedTestkit: TestkitDriver = new TestkitDriver();

  constructor(private pathToDockerCompose: string) {}

  getAppConfig() {
    return {
      EthereumEndpoint: 'http://ganache:7545',
      SignerEndpoint: 'http://signer:7777',
      EthereumDelegationsContract: this.sharedTestkit.ethereumContractAddresses?.Delegations,
      EthereumRewardsContract: this.sharedTestkit.ethereumContractAddresses?.Rewards,
      DelegateAddress: this.sharedTestkit.delegateAddress,
      StatusJsonPath: './status/status.json',
      StatusPollTimeSeconds: 1,
      HistoryPollIntervalSeconds: 1,
      EthereumFirstBlock: 0,
    };
  }

  // runs all the docker instances with docker-compose
  launchServices() {
    log('[E2E] driver launchServices() start');

    // step 1 - launch ganache docker
    log('[E2E] launch ganache docker');
    this.envName = dockerComposeTool(beforeAll, afterAll, this.pathToDockerCompose, {
      startOnlyTheseServices: ['ganache'],
      containerCleanUp: false,
    } as any);

    // step 2 - let ganache warm up
    beforeAll(async () => {
      log('[E2E] wait 5 seconds for ganache to warm up');
      await sleep(5000);
    });

    // step 3 - deploy ethereum PoS contracts to ganache
    beforeAll(async () => {
      log('[E2E] deploy ethereum PoS contracts to ganache');
      jest.setTimeout(60 * 1000);
      const ganacheAddress = await getAddressForService(this.envName, this.pathToDockerCompose, 'ganache', 7545);
      await this.sharedTestkit.deployOrbsV2Contracts(() => {
        return new Web3(
          new (HDWalletProvider as any)(
            'vanish junk genuine web seminar cook absurd royal ability series taste method identify elevator liquid',
            `http://localhost:${portFromAddress(ganacheAddress)}`,
            0,
            100,
            false
          )
        );
      });
      log('[E2E] ethereum PoS contracts deployed');
      await this.sharedTestkit.prepareScenario();
    });

    // step 4 - write config file for app
    beforeAll(() => {
      log('[E2E] write config file for app');
      const configFilePath = join(__dirname, 'app-config.json');
      try {
        unlinkSync(configFilePath);
      } catch (err) {}
      writeFileSync(configFilePath, JSON.stringify(this.getAppConfig()));
    });

    // step 5 - launch app docker
    log('[E2E] launch app docker');
    dockerComposeTool(beforeAll, afterAll, this.pathToDockerCompose, {
      envName: this.envName,
      startOnlyTheseServices: ['app'],
      shouldPullImages: false,
      cleanUp: false,
      // containerCleanUp: false
    } as any);

    // // old step - print app logs from docker on failure
    // test.serial.afterEach.always('print logs on failures', async (t) => {
    //     if (t.passed) return;
    //     const logs = await getLogsForService(this.envName, this.pathToDockerCompose, 'app');
    //     t.log(logs);
    // });

    // step 6 - start live dump of logs from app to test logger
    beforeAll(async () => {
      log('[E2E] start live dump of logs from app to test logger');
      const logP = exec(`docker-compose -p ${this.envName} -f "${this.pathToDockerCompose}" logs -f app`);
      if (!logP.stdout) return;
      logP.stdout.on('data', (data) => {
        log(data);
      });
      logP.on('exit', () => {
        log(`app log exited`);
      });
    });

    log('[E2E] driver launchServices() finished');
  }

  // inspired by https://github.com/applitools/docker-compose-mocha/blob/master/lib/get-logs-for-service.js
  async catJsonInService(serviceName: string, filePath: string) {
    return await retry(
      async () => {
        const data = (
          await execPromise(
            `docker-compose -p ${this.envName} -f "${this.pathToDockerCompose}" exec -T ${serviceName} cat "${filePath}"`
          )
        ).stdout;
        return JSON.parse(data);
      },
      { retries: 10, delay: 300 }
    );
  }
}

function portFromAddress(address: string) {
  return address.split(':')[1];
}

function log(msg: string) {
  console.log(msg);
}
