import { EventHistory } from 'rewards-v2/dist/src/history';

export interface IHistoryService {
  setAddress: (address: string) => void;
  loadExistingEventHistory: (eventHistory: EventHistory) => void;
  downloadHistoryForAddress: (address: string) => void;
  processNextBatch(latestEthereumBlock: number): Promise<{ lastProcessedBlock: number; eventHistory: EventHistory }>;
}
