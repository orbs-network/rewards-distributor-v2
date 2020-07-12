// the main external api to populate the data model (synchronize over all event history)
export { HistoryDownloader } from './history-downloader';

// the main external api to distribute rewards
export { Distribution } from './distributor';

export interface EthereumContractAddresses {
  Delegations: string;
  Rewards: string;
}

export { EventHistory } from './model';
export { TransactionBatch } from './ethereum';
