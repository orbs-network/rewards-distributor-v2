import React from 'react';
import {AppBar, createStyles, IconButton, Toolbar, Typography} from "@material-ui/core";
import MenuIcon from '@material-ui/icons/Menu';
import {makeStyles} from "@material-ui/core/styles";

interface IProps {
    onMenuClick: () => void;
}


const useStyles = makeStyles((theme) => {
    return createStyles({
        appBar: {
            // DEV_NOTE : Example says to use the zIndex of 'drawer' but on testing it works only when giving higher
            //              zIndex from that of the modal (backdrop)
            zIndex: theme.zIndex.modal + 1,
        },
    })
});

export const TopBar = React.memo<IProps>(props => {
    const {onMenuClick} = props;
    const classes = useStyles();
    return (
        <AppBar position={'fixed'} className={classes.appBar}>
            <Toolbar>
                <IconButton edge="start" color="inherit" aria-label="menu" onClick={onMenuClick}>
                    <MenuIcon/>
                </IconButton>
                <Typography variant="h6">
                    Orbs Rewards distribution
                </Typography>
            </Toolbar>
        </AppBar>
    );
});