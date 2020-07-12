import { sendTransactionBatch } from './send';
import { Distribution, TransactionBatch } from 'rewards-v2';
import Signer from 'orbs-signer-client';
import { sleep, jsonStringifyComplexTypes } from '../helpers';
import { State } from '../model/state';
import { exampleConfig } from '../config.example';
import BN from 'bn.js';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

function getConfiguation() {
  return {
    ...exampleConfig,
    EthereumPendingTxPollTimeSeconds: 0.01,
    EthereumDiscountTxTimeoutSeconds: 0.5,
  };
}

function getMockWeb3Client(behavior: 'success' | 'badsend' | 'pending' | 'revert' | 'removed' | 'overmax' = 'success') {
  return ({
    eth: {
      getTransactionCount: async () => {
        await sleep(0);
        return 17;
      },
      getGasPrice: async () => {
        await sleep(0);
        if (behavior == 'overmax') return '999000000000';
        return '40000000000';
      },
      sendSignedTransaction: async () => {
        await sleep(0);
        if (behavior == 'badsend') throw new Error('send error');
      },
      getTransaction: async () => {
        await sleep(0);
        if (behavior == 'removed') return null;
        if (behavior == 'pending') return { blockNumber: null };
        else return { blockNumber: 117 };
      },
      getTransactionReceipt: async () => {
        await sleep(0);
        if (behavior == 'pending') return null;
        if (behavior != 'revert') return { status: true, blockNumber: 117 };
        else return { status: false, blockNumber: 117 };
      },
    },
  } as unknown) as Web3;
}

function getMockRewardsContract() {
  return {
    options: {
      address: '0xaddress',
    },
    methods: {
      distributeOrbsTokenStakingRewards: () => {
        return { encodeABI: () => '0xencodedAbi' };
      },
    },
  };
}

function getMockSigner(successful = true) {
  return ({
    sign: async () => {
      await sleep(0);
      if (!successful) return {};
      return {
        rawTransaction: '0xrawTx',
        transactionHash: '0xtxHash',
      };
    },
  } as unknown) as Signer;
}

function getMockDistribution(web3?: Web3, rewards?: Contract) {
  return ({
    ethereum: {
      web3: web3 ?? getMockWeb3Client(),
      contracts: {
        Rewards: rewards ?? getMockRewardsContract(),
      },
    },
    firstBlock: 6666,
    lastBlock: 7777,
    split: { fractionForDelegators: 0.7 },
  } as unknown) as Distribution;
}

function getExampleBatch(): TransactionBatch {
  return [
    {
      recipientAddresses: ['0xA', '0xB'],
      amounts: [new BN(100), new BN(200)],
      totalAmount: new BN(300),
      txIndex: 0,
    },
    {
      recipientAddresses: ['0xC'],
      amounts: [new BN(400)],
      totalAmount: new BN(400),
      txIndex: 1,
    },
  ];
}

describe('sendTransactionBatch', () => {
  it('does nothing if batch is empty', async () => {
    const state = new State();
    await sendTransactionBatch([], getMockDistribution(), getMockSigner(), state, getConfiguation());
    expect(state.LastTransactions).toEqual([]);
  });

  it('sends a few transactions successfully', async () => {
    const state = new State();
    const batch = getExampleBatch();
    await sendTransactionBatch(batch, getMockDistribution(), getMockSigner(), state, getConfiguation());

    // console.log('last transactions:', jsonStringifyComplexTypes(state.LastTransactions));

    expect(state.LastTransactions).toMatchObject([
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 24000000000,
        Status: 'successful',
        TxHash: '0xtxHash',
        EthBlock: 117,
        DistributionName: '6666-7777',
        TxIndex: 0,
        NumRecipients: 2,
        TotalAmount: '300',
      },
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 24000000000,
        Status: 'successful',
        TxHash: '0xtxHash',
        EthBlock: 117,
        DistributionName: '6666-7777',
        TxIndex: 1,
        NumRecipients: 1,
        TotalAmount: '400',
      },
    ]);
  });

  it('handles failed send', async () => {
    const state = new State();
    const batch = getExampleBatch();
    const web3 = getMockWeb3Client('badsend');
    await sendTransactionBatch(batch, getMockDistribution(web3), getMockSigner(), state, getConfiguation());

    // console.log('last transactions:', jsonStringifyComplexTypes(state.LastTransactions));

    expect(state.LastTransactions).toMatchObject([
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 24000000000,
        Status: 'failed-send',
        TxHash: '',
        EthBlock: 0,
        DistributionName: '6666-7777',
        TxIndex: 0,
        NumRecipients: 2,
        TotalAmount: '300',
      },
    ]);
  });

  it('handles revert', async () => {
    const state = new State();
    const batch = getExampleBatch();
    const web3 = getMockWeb3Client('revert');
    await sendTransactionBatch(batch, getMockDistribution(web3), getMockSigner(), state, getConfiguation());

    // console.log('last transactions:', jsonStringifyComplexTypes(state.LastTransactions));

    expect(state.LastTransactions).toMatchObject([
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 24000000000,
        Status: 'revert',
        TxHash: '0xtxHash',
        EthBlock: 117,
        DistributionName: '6666-7777',
        TxIndex: 0,
        NumRecipients: 2,
        TotalAmount: '300',
      },
    ]);
  });

  it('handles removed from pool', async () => {
    const state = new State();
    const batch = getExampleBatch();
    const web3 = getMockWeb3Client('removed');
    await sendTransactionBatch(batch, getMockDistribution(web3), getMockSigner(), state, getConfiguation());

    //console.log('last transactions:', jsonStringifyComplexTypes(state.LastTransactions));

    expect(state.LastTransactions).toMatchObject([
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 24000000000,
        Status: 'removed-from-pool',
        TxHash: '0xtxHash',
        EthBlock: 0,
        DistributionName: '6666-7777',
        TxIndex: 0,
        NumRecipients: 2,
        TotalAmount: '300',
      },
    ]);
  });

  it('sets timeout if enough time passes on pending', async () => {
    const state = new State();
    const batch = getExampleBatch();
    const web3 = getMockWeb3Client('pending');
    await sendTransactionBatch(batch, getMockDistribution(web3), getMockSigner(), state, getConfiguation());

    //console.log('last transactions:', jsonStringifyComplexTypes(state.LastTransactions));

    expect(state.LastTransactions).toMatchObject([
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 24000000000,
        Status: 'timeout',
        TxHash: '0xtxHash',
        EthBlock: 0,
        DistributionName: '6666-7777',
        TxIndex: 0,
        NumRecipients: 2,
        TotalAmount: '300',
      },
    ]);
  });

  it('enforces maximum gas price', async () => {
    const state = new State();
    const batch = getExampleBatch();
    const web3 = getMockWeb3Client('overmax');
    await sendTransactionBatch(batch, getMockDistribution(web3), getMockSigner(), state, getConfiguation());

    // console.log('last transactions:', jsonStringifyComplexTypes(state.LastTransactions));

    expect(state.LastTransactions).toMatchObject([
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 100000000000,
        Status: 'successful',
        TxHash: '0xtxHash',
        EthBlock: 117,
        DistributionName: '6666-7777',
        TxIndex: 0,
        NumRecipients: 2,
        TotalAmount: '300',
      },
      {
        SendTime: expect.any(Number),
        GasPriceStrategy: 'discount',
        GasPrice: 100000000000,
        Status: 'successful',
        TxHash: '0xtxHash',
        EthBlock: 117,
        DistributionName: '6666-7777',
        TxIndex: 1,
        NumRecipients: 1,
        TotalAmount: '400',
      },
    ]);
  });

  it('chooses discount gas strategy only if last tx was successful', async () => {
    const state = new State();
    const batch = getExampleBatch();
    await sendTransactionBatch(batch, getMockDistribution(), getMockSigner(), state, getConfiguation());

    expect(state.LastTransactions.length).toEqual(2);
    expect(state.LastTransactions[0].GasPriceStrategy).toEqual('discount');
    expect(state.LastTransactions[0].GasPrice).toEqual(24000000000);
    expect(state.LastTransactions[1].GasPriceStrategy).toEqual('discount');
    expect(state.LastTransactions[1].GasPrice).toEqual(24000000000);

    state.LastTransactions[state.LastTransactions.length - 1].Status = 'timeout';
    await sendTransactionBatch(batch, getMockDistribution(), getMockSigner(), state, getConfiguation());

    expect(state.LastTransactions.length).toEqual(4);
    expect(state.LastTransactions[2].GasPriceStrategy).toEqual('recommended');
    expect(state.LastTransactions[2].GasPrice).toEqual(40000000000);
    expect(state.LastTransactions[3].GasPriceStrategy).toEqual('discount');
    expect(state.LastTransactions[3].GasPrice).toEqual(24000000000);
  });
});
