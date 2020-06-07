import React, {useCallback} from 'react';
import {useRecoilState, useRecoilValue} from "recoil";
import {historySyncState, lastHistoryBlockState} from "../state/HistoryState";
import {Button, Typography} from "@material-ui/core";
import {SyncGauge} from "../componentes/graphs/SyncGauge";
import {highestKnownEthereumBlockState, useUpdateLatestBlockNumberCB} from "../state/CryptoWalletConnectionState";
import {GENESIS_BLOCK_NUMBER} from "../constants";
import {useCryptoWalletConnectionService} from "../services/servicesHooks";

interface IProps {

}

export const SyncPage = React.memo<IProps>(props => {
    const cryptoWalletConnectionService = useCryptoWalletConnectionService();
   const lastHistoryBlock = useRecoilValue(lastHistoryBlockState);
   const highestKnownEthereumBlock = useRecoilValue(highestKnownEthereumBlockState);
   const [historySync, setHistorySyncState] = useRecoilState(historySyncState);

   const updateLatestKnownEthereumBlock = useUpdateLatestBlockNumberCB(cryptoWalletConnectionService);
   const resumeHistorySync = useCallback(() => setHistorySyncState('active'), [setHistorySyncState]);
   const pauseHistorySync = useCallback(() => setHistorySyncState('paused'), [setHistorySyncState]);

   return (
       <>
          <Typography variant={'h5'}>Sync is : {historySync}</Typography>
          <Typography>{lastHistoryBlock} / {highestKnownEthereumBlock} }</Typography>
          <Button onClick={resumeHistorySync} color={'secondary'} variant={'contained'}>
             Start Sync
          </Button>
          <Button onClick={pauseHistorySync} color={'secondary'} variant={'contained'}>
             Pause Sync
          </Button>
           <Button onClick={updateLatestKnownEthereumBlock} color={'secondary'} variant={'contained'}>
               Update latest Ethereum block
           </Button>
          <SyncGauge currentSyncedBlock={lastHistoryBlock} highestBlock={highestKnownEthereumBlock} lowestBlock={GENESIS_BLOCK_NUMBER}/>
       </>
   );
});