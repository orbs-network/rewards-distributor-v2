import { IHistoryStateStorageObject } from '../../state/HistoryState';

export interface IStorageService {
  loadHistorySyncState(historyStateStorageObject: IHistoryStateStorageObject): Promise<void>;
  setHistorySyncState(): Promise<IHistoryStateStorageObject | null>;
}
