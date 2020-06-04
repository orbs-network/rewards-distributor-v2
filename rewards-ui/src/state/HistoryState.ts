import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { EventHistory } from 'rewards-v2/dist/src/history';
import { useCallback, useEffect } from 'react';
import { IHistoryService } from '../services/historyService/IHistoryService';
import { ICryptoWalletConnectionService } from '../services/cryptoWalletConnectionService/ICryptoWalletConnectionService';
import useInterval from 'use-interval';
import { highestKnownEthereumBlockState } from './CryptoWalletConnectionState';

export type THistorySyncState = 'active' | 'paused' | 'off';
export interface IHistoryStateStorageObject {
  latestBlock: number;
  historyForDelegate?: EventHistory;
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

export const useSyncHistory = (historyService: IHistoryService) => {
  const [historyForDelegate, setHistoryForDelegate] = useRecoilState(historyForDelegateState);
  const [lastHistoryBlock, setLastHistoryBlock] = useRecoilState(lastHistoryBlockState);
  const historySync = useRecoilValue(historySyncState);
  const highestKnownEthereumBlock = useRecoilValue(highestKnownEthereumBlockState);

  useEffect(() => {
    let effectActive = false;

    async function processBatch() {
      const { eventHistory, lastProcessedBlock } = await historyService.processNextBatch(highestKnownEthereumBlock);

      if (effectActive) {
        console.log('Effect Active');
      } else {
        console.log('Effect not active');
      }
    }

    if (historySync === 'off' || historySync === 'paused') {
      console.log('Not running');
    } else if (historySync === 'active') {
      console.log('Will start to run');
      processBatch().catch((e) => console.error(`error while processing batch ${e}`));
    }

    return () => {
      console.log("Canceling 'useSyncHistory'");
    };
  }, [highestKnownEthereumBlock, historyService, historySync]);
};

export const useReactToAddressChangeEffect = (historyService: IHistoryService, address: string) => {
  useEffect(() => {
    historyService.setAddress(address);
  }, [address, historyService]);
};
