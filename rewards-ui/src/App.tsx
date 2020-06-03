import React, { useCallback, useEffect, useMemo } from 'react';
import logo from './logo.svg';
import './App.css';
import { sum } from 'rewards-v2/dist/src/sum';
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
import { useBoolean } from 'react-hanger';
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
  usePeriodicallyUpdateBlockNumber,
  useSyncHistory,
} from './state/HistoryState';
import { UPDATE_ETHEREUM_BLOCK_INTERVAL_MS } from './constants';

function App() {
  // const drawerOpen = useBoolean(false);
  const historyService = useHistoryService();
  const cryptoWalletConnectionService = useCryptoWalletConnectionService();
  const [drawerOpen, setDrawerOpen] = useRecoilState(drawerOpenState);
  const [historySync, setHistorySyncState] = useRecoilState(historySyncState);

  // Manages periodically reading of the latest block
  usePeriodicallyUpdateBlockNumber(cryptoWalletConnectionService, UPDATE_ETHEREUM_BLOCK_INTERVAL_MS);

  // Manages the syncing of the history
  useSyncHistory(historyService);

  useEffect(() => {
    // historyService.downloadHistoryForAddress('0xC5e624d6824e626a6f14457810E794E4603CFee2');
    // historyService.downloadHistoryForAddress('0xf7ae622C77D0580f02Bcb2f92380d61e3F6e466c');
  }, [historyService]);

  // @ts-ignore
  const ethereum = window.ethereum;
  const web3Instance = useMemo(() => {
    return new Web3(ethereum);
  }, [ethereum]);

  const onC = useCallback(() => {
    console.log('Clicked');
  }, []);

  const resumeHistorySync = useCallback(() => setHistorySyncState('active'), [setHistorySyncState]);
  const pauseHistorySync = useCallback(() => setHistorySyncState('paused'), [setHistorySyncState]);

  return (
    <>
      <TopBar onMenuClick={() => setDrawerOpen(!drawerOpen)} />
      {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
      <Toolbar />
      App
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
