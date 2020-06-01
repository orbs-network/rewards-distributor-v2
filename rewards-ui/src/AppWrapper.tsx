import React from 'react'
import App from "./App";
import {RecoilRoot} from 'recoil';
import {ServicesContext} from "./state/ServicesState";
import {buildServices} from "./services/Services";
import Web3 from "web3";

interface IProps {

}

// @ts-ignore
const ethereum = window.ethereum;
const web3 = new Web3(ethereum);

const services = buildServices(web3)

export const AppWrapper = React.memo<IProps>((props) => {
    const {} = props;

    return (
        <ServicesContext.Provider value={services}>
            <RecoilRoot>
                <App/>
            </RecoilRoot>
        </ServicesContext.Provider>

    )
});
