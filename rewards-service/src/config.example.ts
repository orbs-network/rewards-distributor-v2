import { Configuration } from './config';

export const exampleConfig: Configuration = {
  EthereumEndpoint: 'http://ganache:7545',
  SignerEndpoint: 'http://signer:7777',
  EthereumCommitteeContract: '0x550f66F3248aa594376638277F0290D462C9Df9E',
  EthereumDelegationsContract: '0x6333c9549095651fCc8252345d6898208eBE8aaa',
  EthereumRewardsContract: '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc',
  DelegateAddress: '0x16fcF728F8dc3F687132f2157D8379c021a08C12',
  StatusJsonPath: './status/status.json',
  RunLoopPollTimeSeconds: 1,
};
