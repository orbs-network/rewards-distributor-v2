import { useEffect } from 'react';
import { useInitializeCryptoWalletConnectionStateFunction } from './CryptoWalletConnectionState';
import { ICryptoWalletConnectionService } from '../services/cryptoWalletConnectionService/ICryptoWalletConnectionService';

export const useInitStatesEffect = (cryptoWalletConnectionService: ICryptoWalletConnectionService) => {
  const initializeCryptoWalletConnectionStateFunction = useInitializeCryptoWalletConnectionStateFunction(
    cryptoWalletConnectionService,
  );

  useEffect(() => {
    initializeCryptoWalletConnectionStateFunction();
  }, [initializeCryptoWalletConnectionStateFunction]);
};
