import { IStorageService } from './IStorageService';
import { IHistoryStateStorageObject } from '../../state/HistoryState';
import store from 'store2';

const HISTORY_STATE_STORAGE_KEY = 'historyStateStorage';

export class StorageService implements IStorageService {
  public async loadHistorySyncState(historyStateStorageObject: IHistoryStateStorageObject): Promise<void> {
    return store(HISTORY_STATE_STORAGE_KEY, historyStateStorageObject);
  }

  public async setHistorySyncState(): Promise<IHistoryStateStorageObject | null> {
    return store(HISTORY_STATE_STORAGE_KEY);
  }
}
