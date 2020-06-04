import { IServices } from './Services';
import { useContext } from 'react';
import { ServicesContext } from '../state/ServicesState';
import { IHistoryService } from './historyService/IHistoryService';
import { ICryptoWalletConnectionService } from './cryptoWalletConnectionService/ICryptoWalletConnectionService';
import { IStorageService } from './storageService/IStorageService';

export function useServices(): IServices {
  const services = useContext(ServicesContext);

  if (!services) {
    throw new Error('Tried to use services before initialising them');
  }

  return services;
}

export function useHistoryService(): IHistoryService {
  return useServices().historyService;
}

export function useCryptoWalletConnectionService(): ICryptoWalletConnectionService {
  return useServices().cryptoWalletIntegrationService;
}

export function useStorageService(): IStorageService {
  return useServices().storageService;
}
