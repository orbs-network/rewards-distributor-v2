import React, {useMemo} from 'react';
import logo from './logo.svg';
import './App.css';
import { sum } from 'rewards-v2/dist/src/sum';
import {Container, Divider, Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar} from '@material-ui/core'
import {TopBar} from "./componentes/structure/TopBar";
import { useBoolean } from 'react-hanger';
import MailIcon from '@material-ui/icons/Mail';
import InboxIcon from '@material-ui/icons/MoveToInbox';
import Web3 from 'web3';
import {useRecoilState} from "recoil";
import {drawerOpenState} from "./state/StructureState";

function App() {
    // const drawerOpen = useBoolean(false);
    const [drawerOpen, setDrawerOpen] = useRecoilState(drawerOpenState);

    // @ts-ignore
    const ethereum = window.ethereum;
    const web3Instance = useMemo(() => {
        return new Web3(ethereum);
    }, [ethereum])

  return (
    // <div className="App">
    //   <header className="App-header">
    //     <img src={logo} className="App-logo" alt="logo" />
    //     <p>
    //       The sum of 1 and 2 is { sum(1,2) }
    //     </p>
    //     <a
    //       className="App-link"
    //       href="https://reactjs.org"
    //       target="_blank"
    //       rel="noopener noreferrer"
    //     >
    //       Learn React
    //     </a>
    //   </header>
    // </div>
      <>
          <TopBar onMenuClick={() => setDrawerOpen(!drawerOpen)}/>
          App
          <Drawer anchor={'left'} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
              {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
              <Toolbar />
              <List>
                  <ListItem>
                      <ListItemIcon><MailIcon/></ListItemIcon>
                      <ListItemText primary={'First Link'} />
                  </ListItem>
                  <Divider/>
                  <ListItem>
                      <ListItemIcon><InboxIcon/></ListItemIcon>
                      <ListItemText primary={'Other Link'} />
                  </ListItem>
              </List>
          </Drawer>
      </>
  );
}

export default App;
