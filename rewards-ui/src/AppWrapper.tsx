import React, {useCallback, useMemo} from 'react'
import App from "./App";
import {RecoilRoot} from 'recoil';
import {ServicesContext} from "./state/ServicesState";
import {buildServices} from "./services/Services";
import {IEthereumProvider} from "./services/cryptoWalletConnectionService/IEthereumProvider";
import {NoEthereumProviderPage} from "./pages/NoEthereumProviderPage";
import {bnDivideAsNumber} from "rewards-v2/dist/src/helpers";
import {ConnectMetaMaskPage} from "./pages/ConnectMetamaskPage";
import {useCryptoWalletConnectionService} from "./services/servicesHooks";
import {useAskPermissionForCryptoWallet} from "./state/CryptoWalletConnectionState";

interface IProps {

}

export const AppWrapper = React.memo<IProps>((props) => {
    const {} = props;

    const ethereum: IEthereumProvider = (window as any).ethereum;
    const hasEthereumProvider = !!ethereum;

    const services = useMemo(() => {
        if (hasEthereumProvider) {
            return buildServices(ethereum)
        }
    }, [ethereum, hasEthereumProvider])

    const connect = useCallback(async () => {
        await services?.cryptoWalletIntegrationService.requestConnectionPermission();
    }, [services?.cryptoWalletIntegrationService?.requestConnectionPermission]);

    // TODO : ORL : Add handling for no Ethereum provider.
    if (!hasEthereumProvider) {
        return <NoEthereumProviderPage/>
    }

    return (
        <ServicesContext.Provider value={services}>
            <RecoilRoot>
                <App/>
            </RecoilRoot>
        </ServicesContext.Provider>

    )
});
