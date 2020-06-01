import {HistoryService} from "./historyService/HistoryService";
import Web3 from "web3";
import {ICryptoWalletConnectionService} from "./cryptoWalletConnectionService/ICryptoWalletConnectionService";
import {IHistoryService} from "./historyService/IHistoryService";
import {CryptoWalletConnectionService} from "./cryptoWalletConnectionService/CryptoWalletConnectionService";
import {IEthereumProvider} from "./cryptoWalletConnectionService/IEthereumProvider";

export interface IServices {
    historyService: IHistoryService;
    cryptoWalletIntegrationService: ICryptoWalletConnectionService;
}

// DEV_NOTE : For simplicity of early stage dev, we assume that we have ethereum provider, if not, we will not initialize the services.
export function buildServices(ethereumProvider: IEthereumProvider): IServices {
    // TODO : FUTURE : O.L : Improve typing of 'IEthereumProvider' to be compatible.
    const web3: Web3 = new Web3(ethereumProvider as any);

    return {
        historyService: new HistoryService(web3),
        cryptoWalletIntegrationService: new CryptoWalletConnectionService(ethereumProvider)
    }
}