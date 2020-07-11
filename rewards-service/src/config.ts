export interface Configuration {
  EthereumEndpoint: string;
  SignerEndpoint: string;
  EthereumDelegationsContract: string;
  EthereumRewardsContract: string;
  GuardianAddress: string;
  NodeOrbsAddress: string;
  StatusJsonPath: string;
  StatusPollTimeSeconds: number;
  DistributorWakeIntervalSeconds: number;
  EthereumFirstBlock: number;
  DefaultDistributionFrequencySeconds: number;
  EthereumPendingTxPollTimeSeconds: number;
  RewardFractionForDelegators: number;
  EthereumDiscountGasPriceFactor: number;
  EthereumDiscountTxTimeoutSeconds: number;
  EthereumNonDiscountTxTimeoutSeconds: number;
  EthereumMaxGasPrice: number;
}

export const defaultConfiguration = {
  StatusJsonPath: './status/status.json',
  StatusPollTimeSeconds: 20,
  DistributorWakeIntervalSeconds: 5 * 60,
  EthereumFirstBlock: 0,
  DefaultDistributionFrequencySeconds: 14 * 24 * 60 * 60,
  EthereumPendingTxPollTimeSeconds: 3 * 60,
  RewardFractionForDelegators: 0.7,
  EthereumDiscountGasPriceFactor: 0.6,
  EthereumDiscountTxTimeoutSeconds: 60 * 60,
  EthereumNonDiscountTxTimeoutSeconds: 20 * 60,
  EthereumMaxGasPrice: 150000000000, // 150 gwei
};

export function validateConfiguration(config: Configuration) {
  if (!config.EthereumEndpoint) {
    throw new Error(`EthereumEndpoint is empty in config.`);
  }
  if (!config.SignerEndpoint) {
    throw new Error(`SignerEndpoint is empty in config.`);
  }
  if (!config.EthereumDelegationsContract) {
    throw new Error(`EthereumDelegationsContract is empty in config.`);
  }
  if (!config.EthereumDelegationsContract.startsWith('0x')) {
    throw new Error(`EthereumDelegationsContract does not start with "0x".`);
  }
  if (!config.EthereumRewardsContract) {
    throw new Error(`EthereumRewardsContract is empty in config.`);
  }
  if (!config.EthereumRewardsContract.startsWith('0x')) {
    throw new Error(`EthereumRewardsContract does not start with "0x".`);
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
  if (!config.DefaultDistributionFrequencySeconds) {
    throw new Error(`DefaultDistributionFrequencySeconds is empty or zero.`);
  }
  if (typeof config.DefaultDistributionFrequencySeconds != 'number') {
    throw new Error(`DefaultDistributionFrequencySeconds is not a number.`);
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
}
