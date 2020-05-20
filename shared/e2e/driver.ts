import { Driver as OrbsV2Driver } from '@orbs-network/orbs-ethereum-contracts-v2';
import { Web3Driver } from '@orbs-network/orbs-ethereum-contracts-v2/release/eth';
import { EthereumContractAddresses } from '../src';
import Web3 from 'web3';
import BN from 'bn.js';

const SCENARIO_MAX_STANDBYS = 3;
const SCENARIO_MAX_COMMITTEE_SIZE = 3;
const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

export class TestkitDriver {
  public web3: Web3;
  private orbsV2Driver?: OrbsV2Driver;
  public ethereumContractAddresses?: EthereumContractAddresses;
  public delegateAddress?: string;

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
      Delegations: this.orbsV2Driver.delegations.address,
      StakingRewards: this.orbsV2Driver.stakingRewards.address,
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
    const d = this.orbsV2Driver;
    if (!d) throw new Error(`Call deployOrbsV2Contracts before prepareScenario.`);

    // setup rewards
    const rg = d.rewardsGovernor;
    const annualRate = 12000;
    const poolAmount = 4000000000;
    const annualCap = poolAmount;
    let r = await d.stakingRewards.setAnnualRate(annualRate, annualCap, { from: rg.address });
    await rg.assignAndApproveOrbs(poolAmount, d.stakingRewards.address);
    await d.stakingRewards.topUpPool(poolAmount, { from: rg.address });

    // setup 3 validators (max committee size is 3)
    const v1 = d.newParticipant();
    const v2 = d.newParticipant();
    const v3 = d.newParticipant();
    await v1.registerAsValidator();
    await v2.registerAsValidator();
    await v3.registerAsValidator();
    await v1.stake(1000000);
    await v2.stake(2000000);
    await v3.stake(3000000);
    await v1.notifyReadyForCommittee();
    await v2.notifyReadyForCommittee();
    await v3.notifyReadyForCommittee();

    // setup 6 delegators
    const d1 = d.newParticipant();
    const d2 = d.newParticipant();
    const d3 = d.newParticipant();
    const d4 = d.newParticipant();
    const d5 = d.newParticipant();
    const d6 = d.newParticipant();
    await d1.stake(100000);
    await d2.stake(200000);
    await d3.stake(300000);
    await d4.stake(400000);
    await d5.stake(500000);
    await d6.stake(600000);
    await d1.delegate(v1);
    await d2.delegate(v1);
    await d3.delegate(v2);
    await d4.delegate(v2);
    await d5.delegate(v3);
    await d6.delegate(v3);

    // the delegate running the reward distribution code is v2
    this.delegateAddress = v2.address;

    // assign rewards (TODO: this will become automatic)
    await evmIncreaseTime(d.web3, MONTH_IN_SECONDS * 4);
    await d.stakingRewards.assignRewards();

    // setup 4th validator (that will push v1 out of committee)
    const v4 = d.newParticipant();
    await v4.registerAsValidator();
    await v4.stake(4000000);
    await v4.notifyReadyForCommittee();

    // setup 7th delegator
    const d7 = d.newParticipant();
    await d7.stake(700000);
    await d7.delegate(v4);

    // move some delegators to our delegate (v2)
    await d1.delegate(v2);
    await d5.delegate(v2);

    // assign rewards (TODO: this will become automatic)
    await evmIncreaseTime(d.web3, MONTH_IN_SECONDS * 4);
    await d.stakingRewards.assignRewards();
  }

  async getNewDistributionEvents(fromBlock: number) {
    const res = await this.orbsV2Driver?.stakingRewards.web3Contract.getPastEvents('StakingRewardsDistributed', {
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
    to: string,
    amount: BN
  ) {
    await this.orbsV2Driver?.stakingRewards.distributeOrbsTokenRewards(
      amount,
      fromBlock,
      toBlock,
      split,
      txIndex,
      [to],
      [amount],
      { from: from }
    );
  }

  async getCurrentRewardBalance(delegateAddress: string): Promise<BN> {
    const res = await this.orbsV2Driver?.stakingRewards.getRewardBalance(delegateAddress);
    return new BN(res!);
  }
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
