/* eslint-disable @typescript-eslint/no-empty-function */
import { mocked } from 'ts-jest/utils';
import { State } from '../model/state';
import { exampleConfig } from '../config.example';
import { Distributor } from '.';
import { Distribution } from 'rewards-v2';
import { BlockTransactionObject } from 'web3-eth';
import { getCurrentClockTime } from '../helpers';

jest.mock('rewards-v2', () => {
  return {
    HistoryDownloader: class {
      setEthereumContracts = () => {};
      processNextBatchAutoscale = () => 117;
    },
    Distribution: class {
      static getLastDistribution = jest.fn().mockImplementation(() => null);
      static startNewDistribution = jest.fn().mockImplementation(() => null);
    },
  };
});

jest.mock('web3', () => {
  return class {
    static providers = {
      HttpProvider: () => {},
    };
    eth = {
      getBlockNumber: () => 117,
      getBlock: jest.fn().mockImplementation(() => {
        throw new Error(`unexpected getBlock`);
      }),
    };
  };
});

function getConfiguation(genesisBlock = 0) {
  return {
    ...exampleConfig,
    EthereumFirstBlock: genesisBlock,
  };
}

function getMockDistribution(complete = true, firstTransferBlock = 80) {
  return ({
    isDistributionComplete: () => complete,
    setEthereumContracts: () => {},
    prepareTransactionBatch: jest.fn().mockImplementation(() => []),
    getPreviousTransfers: () => [{ block: firstTransferBlock }],
    ethereum: {
      web3: {},
      contracts: { Rewards: {} },
    },
    firstBlock: firstTransferBlock - 20 + 1,
    lastBlock: firstTransferBlock - 10,
  } as unknown) as Distribution;
}

function getMockBlock(timestamp: number) {
  return ({ timestamp } as unknown) as BlockTransactionObject;
}

describe('distributor task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes an active old distribution before starting a new one', async () => {
    const state = new State();
    const distributor = new Distributor(state, getConfiguation(30));
    const oldDistribution = getMockDistribution(false);
    const nearOldDistributionBlock = getMockBlock(getCurrentClockTime() - 5 * 24 * 60 * 60);

    mocked(Distribution).getLastDistribution.mockReturnValue(oldDistribution);
    mocked(distributor, true).web3.eth.getBlock.mockResolvedValue(nearOldDistributionBlock);

    await distributor.run();

    expect(mocked(Distribution).getLastDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(Distribution).startNewDistribution).toHaveBeenCalledTimes(0);
    expect(oldDistribution.prepareTransactionBatch).toHaveBeenCalledTimes(1);
    expect(state.LastDistributions['61-70'].Complete).toEqual(false);
  });

  it('does not start a new distribution if EthereumFirstBlock is near (when no previous distributions)', async () => {
    const state = new State();
    const distributor = new Distributor(state, getConfiguation(30));
    const nearGenesisBlock = getMockBlock(getCurrentClockTime() - 5 * 24 * 60 * 60);

    mocked(Distribution).getLastDistribution.mockReturnValue(null);
    mocked(distributor, true).web3.eth.getBlock.mockResolvedValue(nearGenesisBlock);

    await distributor.run();

    expect(mocked(Distribution).getLastDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(Distribution).startNewDistribution).toHaveBeenCalledTimes(0);
    expect(mocked(distributor, true).web3.eth.getBlock).toHaveBeenCalledWith(30);
    expect(state.LastDistributions['genesis'].Complete).toEqual(true);
  });

  it('starts a new distribution if EthereumFirstBlock is far (when no previous distributions)', async () => {
    const state = new State();
    const distributor = new Distributor(state, getConfiguation(30));
    const newDistribution = getMockDistribution(false);
    const farGenesisBlock = getMockBlock(getCurrentClockTime() - 25 * 24 * 60 * 60);

    mocked(Distribution).getLastDistribution.mockReturnValue(null);
    mocked(Distribution).startNewDistribution.mockReturnValue(newDistribution);
    mocked(distributor, true).web3.eth.getBlock.mockResolvedValue(farGenesisBlock);

    await distributor.run();

    expect(mocked(Distribution).getLastDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(Distribution).startNewDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(distributor, true).web3.eth.getBlock).toHaveBeenCalledWith(30);
    expect(newDistribution.prepareTransactionBatch).toHaveBeenCalledTimes(1);
    expect(state.LastDistributions['genesis'].Complete).toEqual(true);
  });

  it('does not start a new distribution if last distribution is near (when last is complete)', async () => {
    const state = new State();
    const distributor = new Distributor(state, getConfiguation(30));
    const oldDistribution = getMockDistribution(true, 70);
    const nearOldDistributionBlock = getMockBlock(getCurrentClockTime() - 5 * 24 * 60 * 60);

    mocked(Distribution).getLastDistribution.mockReturnValue(oldDistribution);
    mocked(distributor, true).web3.eth.getBlock.mockResolvedValue(nearOldDistributionBlock);

    await distributor.run();

    expect(mocked(Distribution).getLastDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(Distribution).startNewDistribution).toHaveBeenCalledTimes(0);
    expect(mocked(distributor, true).web3.eth.getBlock).toHaveBeenCalledWith(70);
    expect(state.LastDistributions['51-60'].Complete).toEqual(true);
  });

  it('starts a new distribution if last distribution is far (when last is complete)', async () => {
    const state = new State();
    const distributor = new Distributor(state, getConfiguation(30));
    const oldDistribution = getMockDistribution(true, 70);
    const newDistribution = getMockDistribution(false);
    const farOldDistributionBlock = getMockBlock(getCurrentClockTime() - 25 * 24 * 60 * 60);

    mocked(Distribution).getLastDistribution.mockReturnValue(oldDistribution);
    mocked(Distribution).startNewDistribution.mockReturnValue(newDistribution);
    mocked(distributor, true).web3.eth.getBlock.mockResolvedValue(farOldDistributionBlock);

    await distributor.run();

    expect(mocked(Distribution).getLastDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(Distribution).startNewDistribution).toHaveBeenCalledTimes(1);
    expect(mocked(distributor, true).web3.eth.getBlock).toHaveBeenCalledWith(70);
    expect(newDistribution.prepareTransactionBatch).toHaveBeenCalledTimes(1);
    expect(state.LastDistributions['51-60'].Complete).toEqual(true);
  });
});
