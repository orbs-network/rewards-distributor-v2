export interface Configuration {
  EthereumEndpoint: string;
  SignerEndpoint: string;
  EthereumGenesisContract: string;
  GuardianAddress: string;
  NodeOrbsAddress: string;
  StatusJsonPath: string;
  StatusPollTimeSeconds: number;
  DistributorWakeIntervalSeconds: number;
  EthereumFirstBlock: number;
  DistributionFrequencySeconds: number;
  EthereumPendingTxPollTimeSeconds: number;
  RewardFractionForDelegators: number;
  MaxRecipientsPerRewardsTx: number;
  EthereumDiscountGasPriceFactor: number;
  EthereumDiscountTxTimeoutSeconds: number;
  EthereumNonDiscountTxTimeoutSeconds: number;
  EthereumMaxGasPrice: number;
  EthereumRequestsPerSecondLimit: number;
}

export const defaultConfiguration = {
  StatusJsonPath: './status/status.json',
  StatusPollTimeSeconds: 20,
  DistributorWakeIntervalSeconds: 5 * 60,
  EthereumGenesisContract: '0x5454223e3078Db87e55a15bE541cc925f3702eB0',
  EthereumFirstBlock: 10503000,
  DistributionFrequencySeconds: 14 * 24 * 60 * 60,
  EthereumPendingTxPollTimeSeconds: 3 * 60,
  RewardFractionForDelegators: 0.7,
  MaxRecipientsPerRewardsTx: 50,
  EthereumDiscountGasPriceFactor: 0.6,
  EthereumDiscountTxTimeoutSeconds: 4 * 60 * 60,
  EthereumNonDiscountTxTimeoutSeconds: 20 * 60,
  EthereumMaxGasPrice: 100000000000, // 100 gwei
  EthereumRequestsPerSecondLimit: 0,
};

export function validateConfiguration(config: Configuration) {
  if (!config.EthereumEndpoint) {
    throw new Error(`EthereumEndpoint is empty in config.`);
  }
  if (!config.SignerEndpoint) {
    throw new Error(`SignerEndpoint is empty in config.`);
  }
  if (!config.EthereumGenesisContract) {
    throw new Error(`EthereumGenesisContract is empty in config.`);
  }
  if (!config.EthereumGenesisContract.startsWith('0x')) {
    throw new Error(`EthereumGenesisContract does not start with "0x".`);
  }
  if (!config.GuardianAddress) {
    throw new Error(`GuardianAddress is empty in config.`);
  }
  if (!config.GuardianAddress.startsWith('0x')) {
    throw new Error(`GuardianAddress does not start with "0x".`);
  }
  if (!config.NodeOrbsAddress) {
    throw new Error(`NodeOrbsAddress is empty in config.`);
  }
  if (config.NodeOrbsAddress.startsWith('0x')) {
    throw new Error(`NodeOrbsAddress must not start with "0x".`);
  }
  if (config.GuardianAddress.length != '0x16fcF728F8dc3F687132f2157D8379c021a08C12'.length) {
    throw new Error(`GuardianAddress has incorrect length: ${config.GuardianAddress.length}.`);
  }
  if (!config.StatusJsonPath) {
    throw new Error(`StatusJsonPath is empty in config.`);
  }
  if (!config.StatusPollTimeSeconds) {
    throw new Error(`StatusPollTimeSeconds is empty or zero.`);
  }
  if (typeof config.StatusPollTimeSeconds != 'number') {
    throw new Error(`StatusPollTimeSeconds is not a number.`);
  }
  if (!config.DistributorWakeIntervalSeconds) {
    throw new Error(`DistributorWakeIntervalSeconds is empty or zero.`);
  }
  if (typeof config.DistributorWakeIntervalSeconds != 'number') {
    throw new Error(`DistributorWakeIntervalSeconds is not a number.`);
  }
  if (typeof config.EthereumFirstBlock != 'number') {
    throw new Error(`EthereumFirstBlock is not a number.`);
  }
  if (!config.DistributionFrequencySeconds) {
    throw new Error(`DistributionFrequencySeconds is empty or zero.`);
  }
  if (typeof config.DistributionFrequencySeconds != 'number') {
    throw new Error(`DistributionFrequencySeconds is not a number.`);
  }
  if (!config.EthereumPendingTxPollTimeSeconds) {
    throw new Error(`EthereumPendingTxPollTimeSeconds is empty or zero.`);
  }
  if (typeof config.EthereumPendingTxPollTimeSeconds != 'number') {
    throw new Error(`EthereumPendingTxPollTimeSeconds is not a number.`);
  }
  if (typeof config.RewardFractionForDelegators != 'number') {
    throw new Error(`RewardFractionForDelegators is not a number.`);
  }
  if (config.RewardFractionForDelegators < 0 || config.RewardFractionForDelegators > 1) {
    throw new Error(`RewardFractionForDelegators is not in range 0-1.`);
  }
  if (!config.MaxRecipientsPerRewardsTx) {
    throw new Error(`MaxRecipientsPerRewardsTx is empty or zero.`);
  }
  if (typeof config.MaxRecipientsPerRewardsTx != 'number') {
    throw new Error(`MaxRecipientsPerRewardsTx is not a number.`);
  }
  if (!config.EthereumDiscountGasPriceFactor) {
    throw new Error(`EthereumDiscountGasPriceFactor is empty or zero.`);
  }
  if (typeof config.EthereumDiscountGasPriceFactor != 'number') {
    throw new Error(`EthereumDiscountGasPriceFactor is not a number.`);
  }
  if (!config.EthereumDiscountTxTimeoutSeconds) {
    throw new Error(`EthereumDiscountTxTimeoutSeconds is empty or zero.`);
  }
  if (typeof config.EthereumDiscountTxTimeoutSeconds != 'number') {
    throw new Error(`EthereumDiscountTxTimeoutSeconds is not a number.`);
  }
  if (!config.EthereumNonDiscountTxTimeoutSeconds) {
    throw new Error(`EthereumNonDiscountTxTimeoutSeconds is empty or zero.`);
  }
  if (typeof config.EthereumNonDiscountTxTimeoutSeconds != 'number') {
    throw new Error(`EthereumNonDiscountTxTimeoutSeconds is not a number.`);
  }
  if (!config.EthereumMaxGasPrice) {
    throw new Error(`EthereumMaxGasPrice is empty or zero.`);
  }
  if (typeof config.EthereumMaxGasPrice != 'number') {
    throw new Error(`EthereumMaxGasPrice is not a number.`);
  }
  if (typeof config.EthereumRequestsPerSecondLimit != 'number') {
    throw new Error(`EthereumRequestsPerSecondLimit is not a number.`);
  }
}
