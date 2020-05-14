import { ganacheDriver, Driver as OrbsV2Driver } from '@orbs-network/orbs-ethereum-contracts-v2';
import { EthereumContractAddresses } from '../history';
import Web3 from 'web3';

const SCENARIO_MAX_STANDBYS = 3;
const SCENARIO_MAX_COMMITTEE_SIZE = 3;

export class TestkitDriver {
  static async setup() {
    await ganacheDriver.startGanache();
  }

  static async teardown() {
    await ganacheDriver.stopGanache();
    // sleep 2 seconds for Ganache to fully stop
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  public ethereumContractAddresses?: EthereumContractAddresses;
  public delegateAddress?: string;
  public web3: Web3;
  private orbsV2Driver?: OrbsV2Driver;

  constructor() {
    this.web3 = new Web3('http://localhost:7545');
  }

  async deployOrbsV2Contracts() {
    this.orbsV2Driver = await OrbsV2Driver.new({
      maxStandbys: SCENARIO_MAX_STANDBYS,
      maxCommitteeSize: SCENARIO_MAX_COMMITTEE_SIZE,
    });
    this.ethereumContractAddresses = {
      Committee: this.orbsV2Driver.committeeGeneral.address,
    };
  }

  async closeConnections() {
    const provider = this.orbsV2Driver?.web3?.currentProvider;
    const hdwalletProvider = (provider as unknown) as HDWalletProvider;
    if (hdwalletProvider?.engine?.stop) {
      await hdwalletProvider.engine.stop();
    }
    // sleep 2 seconds for connections to close
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  async prepareScenario() {
    if (!this.orbsV2Driver) throw new Error(`Call deployOrbsV2Contracts first.`);
    const v1 = this.orbsV2Driver.newParticipant();
    const v2 = this.orbsV2Driver.newParticipant();
    const v3 = this.orbsV2Driver.newParticipant();
    const v4 = this.orbsV2Driver.newParticipant();
    await v1.registerAsValidator();
    await v2.registerAsValidator();
    await v3.registerAsValidator();
    await v4.registerAsValidator();
    await v1.stake(1000);
    await v2.stake(2000);
    await v3.stake(3000);
    await v4.stake(4000);
    await v1.notifyReadyForCommittee();
    await v2.notifyReadyForCommittee();
    await v3.notifyReadyForCommittee();
    await v4.notifyReadyForCommittee();
    this.delegateAddress = v2.address;
  }
}

// needed due to missing types
interface HDWalletProvider {
  engine: {
    stop: () => Promise<void>;
  };
}
