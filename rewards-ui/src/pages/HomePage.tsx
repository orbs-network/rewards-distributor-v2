import React, {useCallback} from 'react';
import {Button} from "@material-ui/core";
import {BrowserRouter as Router} from "react-router-dom";
import {useRecoilState, useRecoilValue} from "recoil";
import {historySyncState} from "../state/HistoryState";
import {userAddressState} from "../state/CryptoWalletConnectionState";

interface IProps {

}

export const HomePage = React.memo<IProps>(props => {
    const userAddress = useRecoilValue(userAddressState);
    const [historySync, setHistorySyncState] = useRecoilState(historySyncState);

    const resumeHistorySync = useCallback(() => setHistorySyncState('active'), [setHistorySyncState]);
    const pauseHistorySync = useCallback(() => setHistorySyncState('paused'), [setHistorySyncState]);

    return (
        <>
            App - {userAddress}
            <Button onClick={resumeHistorySync} color={'secondary'} variant={'contained'}>
                Start Sync
            </Button>
            <Button onClick={pauseHistorySync} color={'secondary'} variant={'contained'}>
                Pause Sync
            </Button>
        </>
    )
});