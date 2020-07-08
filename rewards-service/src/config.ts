export interface Configuration {
  EthereumEndpoint: string;
  SignerEndpoint: string;
  EthereumDelegationsContract: string;
  EthereumRewardsContract: string;
  DelegateAddress: string;
  StatusJsonPath: string;
  StatusPollTimeSeconds: number;
  HistoryPollIntervalSeconds: number;
  EthereumFirstBlock: number;
}

export const defaultConfiguration = {
  StatusJsonPath: './status/status.json',
  StatusPollTimeSeconds: 20,
  HistoryPollIntervalSeconds: 5 * 60,
  EthereumFirstBlock: 0,
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
  if (!config.DelegateAddress) {
    throw new Error(`DelegateAddress is empty in config.`);
  }
  if (!config.DelegateAddress.startsWith('0x')) {
    throw new Error(`DelegateAddress does not start with "0x".`);
  }
  if (config.DelegateAddress.length != '0x16fcF728F8dc3F687132f2157D8379c021a08C12'.length) {
    throw new Error(`DelegateAddress has incorrect length: ${config.DelegateAddress.length}.`);
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
  if (!config.HistoryPollIntervalSeconds) {
    throw new Error(`HistoryPollIntervalSeconds is empty or zero.`);
  }
  if (typeof config.HistoryPollIntervalSeconds != 'number') {
    throw new Error(`HistoryPollIntervalSeconds is not a number.`);
  }
  if (typeof config.EthereumFirstBlock != 'number') {
    throw new Error(`EthereumFirstBlock is not a number.`);
  }
}
