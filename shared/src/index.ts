// the main external api to populate the data model (synchronize over all event history)
export { HistoryDownloader } from './history';

// the main external api to distribute rewards
export { Distribution } from './distributor';

export interface EthereumContractAddresses {
  Committee: string;
  Delegations: string;
  Rewards: string;
}
