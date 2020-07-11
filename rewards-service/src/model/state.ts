import { EventHistory } from 'rewards-v2';

export const NUM_LAST_TRANSACTIONS = 10;

export class State {
  HistoryMaxProcessedBlock = 0;
  LastHistoryBatchTime = 0; // UTC seconds
  EventHistory?: EventHistory;
  DistributionFrequencySeconds = 14 * 24 * 60 * 60;
  TimeToNextDistribution = 0; // seconds
  LastDistributionsStartTime: { [distributionName: string]: number } = {};
  LastTransactions: EthereumTxStatus[] = [];
}

// helpers

export type GasPriceStrategy = 'discount' | 'recommended';

export type TransactionStatus = 'pending' | 'successful' | 'failed-send' | 'timeout' | 'removed-from-pool' | 'revert';

export interface EthereumTxStatus {
  SendTime: number; // UTC seconds
  GasPriceStrategy: GasPriceStrategy;
  GasPrice: number; // wei
  Status: TransactionStatus;
  TxHash: string;
  EthBlock: number;
  DistributionName: string;
  TxIndex: number;
  NumRecipients: number;
  TotalAmount: string;
}
