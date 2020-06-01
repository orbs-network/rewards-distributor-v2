import React, {useMemo} from 'react'
import App from "./App";
import {RecoilRoot} from 'recoil';
import {ServicesContext} from "./state/ServicesState";
import {buildServices} from "./services/Services";
import {IEthereumProvider} from "./services/cryptoWalletConnectionService/IEthereumProvider";

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

    // TODO : ORL : Add handling for no Ethereum provider.
    if (!hasEthereumProvider) {
        return <div>No Ethereum Provider</div>
    }

    return (
        <ServicesContext.Provider value={services}>
            <RecoilRoot>
                <App/>
            </RecoilRoot>
        </ServicesContext.Provider>

    )
});
