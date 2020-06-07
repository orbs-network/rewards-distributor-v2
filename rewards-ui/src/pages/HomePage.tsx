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

    return (
        <>
            App - {userAddress}
        </>
    )
});