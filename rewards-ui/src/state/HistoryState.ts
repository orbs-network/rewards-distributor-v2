import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { EventHistory } from 'rewards-v2/dist/src/history';
import { useCallback, useEffect } from 'react';
import { IHistoryService } from '../services/historyService/IHistoryService';
import { ICryptoWalletConnectionService } from '../services/cryptoWalletConnectionService/ICryptoWalletConnectionService';
import useInterval from 'use-interval';

export type THistorySyncState = 'active' | 'paused' | 'off';

export const highestKnownEthereumBlockState = atom<number>({
  key: 'highestKnownEthereumBlockState',
  default: 0,
});

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
      // TODO : C.F.H : Make the basic workflow of the sync work (with finding the latest block, updating the history, saving it to hydrate, updating after each read.)
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
    }

    return () => {
      console.log("Canceling 'useSyncHistory'");
    };
  }, [highestKnownEthereumBlock, historyService, historySync]);
};

export const usePeriodicallyUpdateBlockNumber = (
  cryptoWalletConnectionService: ICryptoWalletConnectionService,
  intervalForUpdates: number,
) => {
  const setHighestKnownEthereumBlockState = useSetRecoilState(highestKnownEthereumBlockState);

  const updateFunction = useCallback(async () => {
    console.log('Reading');
    const latestBlock = await cryptoWalletConnectionService.readCurrentBlockNumber();
    console.log({ latestBlock });
    setHighestKnownEthereumBlockState(latestBlock);
  }, [cryptoWalletConnectionService, setHighestKnownEthereumBlockState]);

  useInterval(updateFunction, intervalForUpdates, true);
};
