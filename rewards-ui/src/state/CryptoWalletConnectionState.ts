import { atom, useSetRecoilState } from 'recoil';
import { ICryptoWalletConnectionService } from '../services/cryptoWalletConnectionService/ICryptoWalletConnectionService';
import { useCallback, useEffect } from 'react';
import useInterval from 'use-interval';

export const highestKnownEthereumBlockState = atom<number>({
  key: 'highestKnownEthereumBlockState',
  default: 0,
});

export const userAddressState = atom<string>({
  key: 'userAddressState',
  default: '',
});

export const walletConnectionRequestApprovedState = atom<boolean>({
  key: 'walletConnectionRequestApprovedState',
  default: false,
});

export const useInitializeCryptoWalletConnectionState = (
  cryptoWalletConnectionService: ICryptoWalletConnectionService,
) => {
  const setWalletConnectionRequestApprovedState = useSetRecoilState(walletConnectionRequestApprovedState);
  const setUserAddressState = useSetRecoilState(userAddressState);

  useEffect(() => {
    setWalletConnectionRequestApprovedState(cryptoWalletConnectionService.didUserApproveDappInThePast);
    cryptoWalletConnectionService.readMainAddress().then((address) => setUserAddressState(address));
  }, [
    cryptoWalletConnectionService,
    cryptoWalletConnectionService.didUserApproveDappInThePast,
    setUserAddressState,
    setWalletConnectionRequestApprovedState,
  ]);
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

export const useSubscribeToAddressChange = (cryptoWalletConnectionService: ICryptoWalletConnectionService) => {
  const setUserAddressState = useSetRecoilState(userAddressState);

  useEffect(() => {
    const unsubscribe = cryptoWalletConnectionService.onMainAddressChange(setUserAddressState);

    return () => {
      unsubscribe();
    };
  }, [cryptoWalletConnectionService, setUserAddressState]);
};

export const useAskPermissionForCryptoWallet = (cryptoWalletConnectionService: ICryptoWalletConnectionService) => {
  return useCallback(async () => {
    const response = await cryptoWalletConnectionService.requestConnectionPermission();
  }, [cryptoWalletConnectionService]);
};
