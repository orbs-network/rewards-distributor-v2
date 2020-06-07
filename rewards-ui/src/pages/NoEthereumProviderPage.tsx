import React, {useCallback} from 'react';
import {Button, Grid, Typography} from "@material-ui/core";

interface IProps {

}

export const NoEthereumProviderPage = React.memo<IProps>(props => {
    const handleInstallClicked = useCallback(async () => {
        window.open('https://metamask.io/', '_blank');
    }, []);

    return (
        <Grid container justify={'center'} direction={'column'} alignItems={'center'} style={{ height: '100vh'}}>
            <Typography style={{ textAlign: 'center' }}> Hey, it seems that you browse from a non-dapp browser</Typography>
            <Typography style={{ textAlign: 'center' }}> Please install the MetaMask extension</Typography>
            <Button onClick={handleInstallClicked} variant={'contained'}>Install</Button>
        </Grid>
    );
});