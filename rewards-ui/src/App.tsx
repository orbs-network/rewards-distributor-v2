import React, { useCallback, useEffect, useMemo } from 'react';
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
import { TopBar } from './componentes/structure/TopBar';
import MailIcon from '@material-ui/icons/Mail';
import InboxIcon from '@material-ui/icons/MoveToInbox';
import Web3 from 'web3';
import { useRecoilState, useRecoilValue } from 'recoil';
import { drawerOpenState } from './state/StructureState';
import { useCryptoWalletConnectionService, useHistoryService } from './services/servicesHooks';
import {
  historyForDelegateState,
  historySyncState,
  lastHistoryBlockState,
  useReactToAddressChange,
  useSyncHistory,
} from './state/HistoryState';
import { UPDATE_ETHEREUM_BLOCK_INTERVAL_MS } from './constants';
import {
  useAskPermissionForCryptoWallet,
  useInitializeCryptoWalletConnectionStateEffect,
  usePeriodicallyUpdateBlockNumber,
  userAddressState,
  useSubscribeToAddressChange,
  walletConnectionRequestApprovedState,
} from './state/CryptoWalletConnectionState';
import { useInitStatesEffect } from './state/CollectiveStateHooks';

function App() {
  const historyService = useHistoryService();
  const cryptoWalletConnectionService = useCryptoWalletConnectionService();
  const [drawerOpen, setDrawerOpen] = useRecoilState(drawerOpenState);
  const [historySync, setHistorySyncState] = useRecoilState(historySyncState);
  const userAddress = useRecoilValue(userAddressState);
  const walletConnectionRequestApproved = useRecoilValue(walletConnectionRequestApprovedState);

  // Initialize the State(s)
  useInitStatesEffect(cryptoWalletConnectionService);

  // Callbacks
  const askPermissionForCryptoWallet = useAskPermissionForCryptoWallet(cryptoWalletConnectionService);

  // TODO : ORL : Remove this after having a proper intro screen.
  if (!walletConnectionRequestApproved) {
    askPermissionForCryptoWallet();
  }

  // Reacts to address change
  useSubscribeToAddressChange(cryptoWalletConnectionService);
  useReactToAddressChange(historyService, userAddress);

  // Manages periodically reading of the latest block
  usePeriodicallyUpdateBlockNumber(cryptoWalletConnectionService, UPDATE_ETHEREUM_BLOCK_INTERVAL_MS);

  // Manages the syncing of the history
  useSyncHistory(historyService);

  // @ts-ignore
  const ethereum = window.ethereum;
  const web3Instance = useMemo(() => {
    return new Web3(ethereum);
  }, [ethereum]);

  const resumeHistorySync = useCallback(() => setHistorySyncState('active'), [setHistorySyncState]);
  const pauseHistorySync = useCallback(() => setHistorySyncState('paused'), [setHistorySyncState]);

  return (
    <>
      <TopBar onMenuClick={() => setDrawerOpen(!drawerOpen)} />
      {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
      <Toolbar />
      App - {userAddress}
      <Button onClick={resumeHistorySync} color={'secondary'} variant={'contained'}>
        Start Sync
      </Button>
      <Button onClick={pauseHistorySync} color={'secondary'} variant={'contained'}>
        Pause Sync
      </Button>
      <Drawer anchor={'left'} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
        <Toolbar />
        <List>
          <ListItem>
            <ListItemIcon>
              <MailIcon />
            </ListItemIcon>
            <ListItemText primary={'First Link'} />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>
              <InboxIcon />
            </ListItemIcon>
            <ListItemText primary={'Other Link'} />
          </ListItem>
        </List>
      </Drawer>
    </>
  );
}

export default App;
