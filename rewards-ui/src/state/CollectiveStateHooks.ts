import { useEffect } from 'react';
import { useInitializeCryptoWalletConnectionStateFunction } from './CryptoWalletConnectionState';
import { ICryptoWalletConnectionService } from '../services/cryptoWalletConnectionService/ICryptoWalletConnectionService';
import { useInitializeHistoryStateFunction } from './HistoryState';
import { IStorageService } from '../services/storageService/IStorageService';
import { IHistoryService } from '../services/historyService/IHistoryService';

export const useInitStatesEffect = (
  cryptoWalletConnectionService: ICryptoWalletConnectionService,
  historyService: IHistoryService,
  storageService: IStorageService,
) => {
  const initializeCryptoWalletConnectionStateFunction = useInitializeCryptoWalletConnectionStateFunction(
    cryptoWalletConnectionService,
  );

  const initializeHistoryStateFunction = useInitializeHistoryStateFunction(historyService, storageService);

  useEffect(() => {
    initializeCryptoWalletConnectionStateFunction();
    initializeHistoryStateFunction();
  }, [initializeCryptoWalletConnectionStateFunction, initializeHistoryStateFunction]);
};
