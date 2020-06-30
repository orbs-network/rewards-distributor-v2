export interface Configuration {
  EthereumEndpoint: string;
  SignerEndpoint: string;
  EthereumCommitteeContract: string;
  EthereumDelegationsContract: string;
  EthereumRewardsContract: string;
  DelegateAddress: string;
  StatusJsonPath: string;
  RunLoopPollTimeSeconds: number;
}

export const defaultConfiguration = {
  StatusJsonPath: './status/status.json',
  RunLoopPollTimeSeconds: 20,
};

export function validateConfiguration(config: Configuration) {
  if (!config.EthereumEndpoint) {
    throw new Error(`EthereumEndpoint is empty in config.`);
  }
  if (!config.SignerEndpoint) {
    throw new Error(`SignerEndpoint is empty in config.`);
  }
  if (!config.EthereumCommitteeContract) {
    throw new Error(`EthereumCommitteeContract is empty in config.`);
  }
  if (!config.EthereumCommitteeContract.startsWith('0x')) {
    throw new Error(`EthereumCommitteeContract does not start with "0x".`);
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
  if (!config.RunLoopPollTimeSeconds) {
    throw new Error(`RunLoopPollTimeSeconds is empty or zero.`);
  }
  if (typeof config.RunLoopPollTimeSeconds != 'number') {
    throw new Error(`RunLoopPollTimeSeconds is not a number.`);
  }
}
