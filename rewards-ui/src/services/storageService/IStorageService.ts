import { IHistoryStateStorageObject } from '../../state/HistoryState';

export interface IStorageService {
  loadHistorySyncState(): Promise<IHistoryStateStorageObject | null>;
  setHistorySyncState(historyStateStorageObject: IHistoryStateStorageObject): void;
}
