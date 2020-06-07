import React, {useCallback} from 'react';
import {Button, Grid, Typography} from "@material-ui/core";
import { useBoolean } from "react-hanger";

interface IProps {
    connectToMetaMask: () => void;
}

export const ConnectMetaMaskPage = React.memo<IProps>(props => {
    const { connectToMetaMask } = props;
    const didUserPressConnect = useBoolean(false);
    const wrappedConnectFunction = useCallback(() => {
        didUserPressConnect.setTrue();
        connectToMetaMask();
    }, [connectToMetaMask, didUserPressConnect]);


    return (
        <Grid container justify={'center'} direction={'column'} alignItems={'center'} style={{ height: '100vh'}}>
            <Typography style={{ textAlign: 'center' }}> Hey, please allow connection to your MetaMask</Typography>
            <Button onClick={wrappedConnectFunction} variant={'contained'}>Connect</Button>
            {didUserPressConnect.value && <Typography style={{ textAlign: 'center' }}> Please approve connection</Typography>}
        </Grid>
    );
});