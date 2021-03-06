import { Driver as OrbsV2Driver } from '@orbs-network/orbs-ethereum-contracts-v2';
import { Web3Driver } from '@orbs-network/orbs-ethereum-contracts-v2/release/eth';
import Web3 from 'web3';
import BN from 'bn.js';
import { bnAddZeroes, normalizeAddress } from '../src/helpers';
import { DriverOptions } from '@orbs-network/orbs-ethereum-contracts-v2/release/test/driver';
import { ContractName } from '../src/ethereum/types';
import { EventData } from 'web3-eth-contract';

const SCENARIO_MAX_COMMITTEE_SIZE = 3;
const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

export class TestkitDriver {
  public web3: Web3;
  public orbsV2Driver?: OrbsV2Driver;
  public delegateAddress?: string;
  public delegateOrbsAddress?: string;

  constructor() {
    this.web3 = new Web3('http://localhost:7545');
  }

  async deployOrbsV2Contracts(customWeb3Provider?: () => Web3) {
    const options: Partial<DriverOptions> = {
      maxCommitteeSize: SCENARIO_MAX_COMMITTEE_SIZE,
    };
    if (customWeb3Provider) options.web3Provider = customWeb3Provider;
    this.orbsV2Driver = await OrbsV2Driver.new(options);
  }

  getContractRegistryAddress(): string {
    const d = this.orbsV2Driver;
    if (!d) throw new Error(`Call deployOrbsV2Contracts before getContractRegistryAddress.`);
    return d.contractRegistry.address;
  }

  getContractAddress(contractName: ContractName): string {
    const d = this.orbsV2Driver;
    if (!d) throw new Error(`Call deployOrbsV2Contracts before getContractAddress.`);
    return d[contractName].address;
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
    const d = this.orbsV2Driver;
    if (!d) throw new Error(`Call deployOrbsV2Contracts before prepareScenario.`);

    // setup rewards
    const annualRate = 12000;
    const poolAmount = inflate15(4000000);
    await d.erc20.assign(d.accounts[0], poolAmount);
    await d.erc20.approve(d.rewards.address, poolAmount);
    await d.rewards.setAnnualStakingRewardsRate(annualRate, poolAmount, { from: d.functionalOwner.address });
    await d.rewards.topUpStakingRewardsPool(poolAmount);
    await d.rewards.setMaxDelegatorsStakingRewardsPercentMille(70000, { from: d.functionalOwner.address });

    // setup 3 validators (max committee size is 3)
    const v1 = d.newParticipant();
    const v2 = d.newParticipant();
    const v3 = d.newParticipant();
    await v1.registerAsGuardian();
    await v2.registerAsGuardian();
    await v3.registerAsGuardian();
    await v1.stake(inflate15(1000000));
    await v2.stake(inflate15(2000000));
    await v3.stake(inflate15(3000000));
    await v1.readyForCommittee();
    await v2.readyForCommittee();
    await v3.readyForCommittee();

    // setup 6 delegators
    const d1 = d.newParticipant();
    const d2 = d.newParticipant();
    const d3 = d.newParticipant();
    const d4 = d.newParticipant();
    const d5 = d.newParticipant();
    const d6 = d.newParticipant();
    await d1.stake(inflate15(100000));
    await d2.stake(inflate15(200000));
    await d3.stake(inflate15(300000));
    await d4.stake(inflate15(400000));
    await d5.stake(inflate15(500000));
    await d6.stake(inflate15(600000));
    await d1.delegate(v1);
    await d2.delegate(v1);
    await d3.delegate(v2);
    await d4.delegate(v2);
    await d5.delegate(v3);
    await d6.delegate(v3);

    // the delegate running the reward distribution code is v2
    this.delegateAddress = normalizeAddress(v2.address);
    this.delegateOrbsAddress = normalizeAddress(v2.orbsAddress);

    // assign rewards (TODO: this will become automatic)
    await evmIncreaseTime(d.web3, MONTH_IN_SECONDS * 4);
    await d.rewards.assignRewards();

    // setup 4th validator (that will push v1 out of committee)
    const v4 = d.newParticipant();
    await v4.registerAsGuardian();
    await v4.stake(inflate15(4000000));
    await v4.readyForCommittee();

    // setup 7th delegator
    const d7 = d.newParticipant();
    await d7.stake(inflate15(700000));
    await d7.delegate(v4);

    // move some delegators to our delegate (v2)
    await d1.delegate(v2);
    await d5.delegate(v2);

    // assign rewards (TODO: this will become automatic)
    await evmIncreaseTime(d.web3, MONTH_IN_SECONDS * 4);
    await d.rewards.assignRewards();
  }

  async getNewDistributionEvents(fromBlock: number): Promise<EventData[]> {
    const res = await this.orbsV2Driver?.rewards.web3Contract.getPastEvents('StakingRewardsDistributed', {
      fromBlock: fromBlock,
      toBlock: 'latest',
    });
    if (!res) return [];
    return res;
  }

  async addManualDistributionEvent(
    fromBlock: number,
    toBlock: number,
    split: number,
    txIndex: number,
    from: string,
    to: string[],
    amounts: BN[]
  ) {
    const total = new BN(0);
    for (const amount of amounts) total.iadd(amount);
    await this.orbsV2Driver?.rewards.distributeOrbsTokenStakingRewards(
      total,
      fromBlock,
      toBlock,
      split,
      txIndex,
      to,
      amounts,
      { from: from }
    );
  }

  async getCurrentRewardBalance(delegateAddress: string): Promise<BN> {
    const res = await this.orbsV2Driver?.rewards.getStakingRewardBalance(delegateAddress);
    return new BN(res!);
  }

  async getCurrentBlock(): Promise<number> {
    const d = this.orbsV2Driver;
    if (!d) throw new Error(`Call deployOrbsV2Contracts before getCurrentBlock.`);
    return await d.web3.eth.getBlockNumber();
  }

  async getCurrentBlockPreDeploy(): Promise<number> {
    return await this.web3.eth.getBlockNumber();
  }
}

export function inflate15(a: number) {
  return bnAddZeroes(a, 15);
}

// taken from https://github.com/orbs-network/orbs-ethereum-contracts-v2/blob/master/test/helpers.ts
export const evmIncreaseTime = async (web3: Web3Driver, seconds: number) =>
  new Promise((resolve, reject) =>
    (web3.currentProvider as any).send({ method: 'evm_increaseTime', params: [seconds] }, (err: any, res: any) =>
      err ? reject(err) : resolve(res)
    )
  );

export function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}

// needed due to missing types
interface HDWalletProvider {
  engine: {
    stop: () => Promise<void>;
  };
}
