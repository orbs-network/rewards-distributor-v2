import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { EventHistory } from 'rewards-v2/dist/src/history';
import { useCallback, useEffect } from 'react';
import { IHistoryService } from '../services/historyService/IHistoryService';
import { ICryptoWalletConnectionService } from '../services/cryptoWalletConnectionService/ICryptoWalletConnectionService';
import useInterval from 'use-interval';
import { highestKnownEthereumBlockState } from './CryptoWalletConnectionState';
import { IStorageService } from '../services/storageService/IStorageService';

export type THistorySyncState = 'active' | 'paused' | 'off';
export interface IHistoryStateStorageObject {
  latestBlock: number;
  historyForDelegate: EventHistory;
}

export const historySyncState = atom<THistorySyncState>({
  key: 'historySyncState',
  default: 'off',
});

export const lastHistoryBlockState = atom<number>({
  key: 'lastHistoryBlockState',
  default: 0,
});

export const historyForDelegateState = atom<EventHistory | null>({
  key: 'historyForDelegateState',
  default: null,
});

export const useProcessNextBatchCallback = () => {};

export const useLoadHistoryFromStorageCB = (historyService: IHistoryService, storageService: IStorageService) => {
  const setLastHistoryBlockState = useSetRecoilState(lastHistoryBlockState);
  const setHistoryForDelegateState = useSetRecoilState(historyForDelegateState);

  return useCallback(async () => {
    const storedState = await storageService.loadHistorySyncState();

    console.log({ storedState });

    if (storedState && storedState.historyForDelegate) {
      // Set the state
      // DEV_NOTE : We create a new object with spread because the values that are set become read-only.
      setHistoryForDelegateState({ ...storedState.historyForDelegate });

      // Update the history service
      historyService.loadExistingEventHistory(storedState.historyForDelegate);
    }

    if (storedState) {
      setLastHistoryBlockState(storedState.latestBlock);
    }
  }, [historyService, setHistoryForDelegateState, setLastHistoryBlockState, storageService]);
};

export const useInitializeHistoryStateFunction = (historyService: IHistoryService, storageService: IStorageService) => {
  const loadHistoryFromStorageCB = useLoadHistoryFromStorageCB(historyService, storageService);

  return useCallback(() => {
    loadHistoryFromStorageCB();
  }, [loadHistoryFromStorageCB]);
};

export const useContinuousHistorySyncEffect = (historyService: IHistoryService, storageService: IStorageService) => {
  const [historyForDelegate, setHistoryForDelegate] = useRecoilState(historyForDelegateState);
  const [lastHistoryBlock, setLastHistoryBlock] = useRecoilState(lastHistoryBlockState);
  const historySync = useRecoilValue(historySyncState);
  const highestKnownEthereumBlock = useRecoilValue(highestKnownEthereumBlockState);

  useEffect(() => {
    let effectActive = true;

    async function processBatch() {
      const { eventHistory, lastProcessedBlock } = await historyService.processNextBatch(highestKnownEthereumBlock);

      if (effectActive) {
        console.log('Effect Active');

        // Save to storage
        storageService.setHistorySyncState({
          historyForDelegate: eventHistory,
          latestBlock: lastProcessedBlock,
        });

        // Update state
        setLastHistoryBlock(lastProcessedBlock);
      } else {
        console.log('Effect not active');
      }
    }

    if (historySync === 'off' || historySync === 'paused') {
      console.log('Not running');
    } else if (historySync === 'active') {
      console.log('Will start to run');
      processBatch().catch((e) => console.error(`error while processing batch ${e}`));
      console.log(`Synced ${lastHistoryBlock} out of ${highestKnownEthereumBlock}`);
    }

    return () => {
      console.log("Canceling 'useSyncHistory'");
      effectActive = false;
    };
  }, [highestKnownEthereumBlock, historyService, historySync, lastHistoryBlock, setLastHistoryBlock, storageService]);
};

export const useReactToAddressChangeEffect = (historyService: IHistoryService, address: string) => {
  useEffect(() => {
    console.log('Address set in effect', address);
    historyService.setAddress(address);
  }, [address, historyService]);
};
