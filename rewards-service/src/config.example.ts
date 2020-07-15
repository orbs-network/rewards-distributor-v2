import { Configuration } from './config';

export const exampleConfig: Configuration = {
  EthereumEndpoint: 'http://ganache:7545',
  SignerEndpoint: 'http://signer:7777',
  EthereumDelegationsContract: '0x6333c9549095651fCc8252345d6898208eBE8aaa',
  EthereumRewardsContract: '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc',
  GuardianAddress: '0x16fcF728F8dc3F687132f2157D8379c021a08C12',
  NodeOrbsAddress: '11f4d0a3c12e86b4b5f39b213f7e19d048276dae',
  StatusJsonPath: './status/status.json',
  StatusPollTimeSeconds: 20,
  DistributorWakeIntervalSeconds: 5 * 60,
  EthereumFirstBlock: 0,
  DistributionFrequencySeconds: 14 * 24 * 60 * 60,
  EthereumPendingTxPollTimeSeconds: 3 * 60,
  RewardFractionForDelegators: 0.7,
  MaxRecipientsPerRewardsTx: 50,
  EthereumDiscountGasPriceFactor: 0.6,
  EthereumDiscountTxTimeoutSeconds: 4 * 60 * 60,
  EthereumNonDiscountTxTimeoutSeconds: 20 * 60,
  EthereumMaxGasPrice: 100000000000, // 100 gwei
};
