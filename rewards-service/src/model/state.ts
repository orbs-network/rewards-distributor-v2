import { EventHistory, DailyStatsData } from 'rewards-v2';

export const NUM_LAST_TRANSACTIONS = 10;

export class State {
  HistoryMaxProcessedBlock = 0;
  LastHistoryBatchTime = 0; // UTC seconds
  EventHistory?: EventHistory;
  TimeToNextDistribution = 0; // seconds
  LastDistributions: { [distributionName: string]: DistributionStats } = {};
  InProgressDistribution?: DistributionStats;
  LastTransactions: EthereumTxStatus[] = [];
  EventRequestStats: DailyStatsData = [];
}

// helpers

export type GasPriceStrategy = 'discount' | 'recommended';

export type TransactionStatus = 'pending' | 'successful' | 'failed-send' | 'timeout' | 'removed-from-pool' | 'revert';

export interface DistributionStats {
  DistributionName: string;
  StartTime: number; // UTC seconds
  Complete: boolean;
  NumNonGuardianRecipients: number;
  TotalNonGuardianAmount: string;
  TotalGuardianAmount: string;
}

export interface EthereumTxStatus {
  DistributionName: string;
  SendTime: number; // UTC seconds
  GasPriceStrategy: GasPriceStrategy;
  GasPrice: number; // wei
  Status: TransactionStatus;
  TxHash: string;
  EthBlock: number;
  TxIndex: number;
  NumRecipients: number;
  TotalAmount: string;
}
