import React, {useCallback, useEffect, useMemo} from 'react';
import './App.css';
import {
    Button,
    Container,
    Divider,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Toolbar,
} from '@material-ui/core';
import {TopBar} from './componentes/structure/TopBar';
import MailIcon from '@material-ui/icons/Mail';
import InboxIcon from '@material-ui/icons/MoveToInbox';
import Web3 from 'web3';
import {useRecoilState, useRecoilValue} from 'recoil';
import {drawerOpenState} from './state/StructureState';
import {useCryptoWalletConnectionService, useHistoryService, useStorageService} from './services/servicesHooks';
import {
    historyForDelegateState,
    historySyncState,
    lastHistoryBlockState,
    useReactToAddressChangeEffect,
    useContinuousHistorySyncEffect,
} from './state/HistoryState';
import {UPDATE_ETHEREUM_BLOCK_INTERVAL_MS} from './constants';
import {
    useAskPermissionForCryptoWallet,
    useInitializeCryptoWalletConnectionStateEffect,
    usePeriodicallyUpdateBlockNumber,
    userAddressState,
    useSubscribeToAddressChange,
    walletConnectionRequestApprovedState,
} from './state/CryptoWalletConnectionState';
import {useInitStatesEffect} from './state/CollectiveStateHooks';
import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom';
import {ListItemLink} from "./componentes/links/ListItemLink";
import {HomePage} from "./pages/HomePage";
import {SyncPage} from "./pages/SyncPage";

function App() {
    const historyService = useHistoryService();
    const cryptoWalletConnectionService = useCryptoWalletConnectionService();
    const storageService = useStorageService();
    const [drawerOpen, setDrawerOpen] = useRecoilState(drawerOpenState);
    const userAddress = useRecoilValue(userAddressState);
    const walletConnectionRequestApproved = useRecoilValue(walletConnectionRequestApprovedState);

    // Initialize the State(s)
    useInitStatesEffect(cryptoWalletConnectionService, historyService, storageService);

    // Callbacks
    const askPermissionForCryptoWallet = useAskPermissionForCryptoWallet(cryptoWalletConnectionService);

    // TODO : ORL : Remove this after having a proper intro screen.
    if (!walletConnectionRequestApproved) {
        askPermissionForCryptoWallet();
    }

    // Reacts to address change
    useSubscribeToAddressChange(cryptoWalletConnectionService);
    useReactToAddressChangeEffect(historyService, userAddress);

    // Manages periodically reading of the latest block
    usePeriodicallyUpdateBlockNumber(cryptoWalletConnectionService, UPDATE_ETHEREUM_BLOCK_INTERVAL_MS);

    // Manages the syncing of the history
    useContinuousHistorySyncEffect(historyService, storageService);

    // @ts-ignore
    const ethereum = window.ethereum;
    const web3Instance = useMemo(() => {
        return new Web3(ethereum);
    }, [ethereum]);


    return (
        <Container>
            <Router>
                <TopBar onMenuClick={() => setDrawerOpen(!drawerOpen)}/>
                {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
                <Toolbar/>
                <Switch>
                    <Route path={'/home'}>
                        <HomePage/>
                    </Route>
                    <Route path={'/sync'}>
                        <SyncPage/>
                    </Route>
                    {/* Default will go to home page */}
                    <Route path={'/'}>
                        <HomePage/>
                    </Route>
                </Switch>

                {/* Side drawer */}
                <Drawer anchor={'left'} open={drawerOpen} onClose={() => setDrawerOpen(false)}
                        onClick={() => setDrawerOpen(false)}>
                    {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
                    <Toolbar/>
                    <List>
                        <ListItemLink to={'/home'} primary={"home"} icon={<MailIcon/>}/>
                        <Divider/>
                        <ListItemLink to={'/sync'} primary={"Sync"} icon={<InboxIcon/>}/>
                    </List>
                </Drawer>
            </Router>
        </Container>
    );
}

export default App;
