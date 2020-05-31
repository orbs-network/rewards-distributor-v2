import React from 'react';
import logo from './logo.svg';
import './App.css';
import { sum } from 'rewards-v2/dist/src/sum';
import {Container, Drawer, Toolbar} from '@material-ui/core'
import {TopBar} from "./componentes/structure/TopBar";
import { useBoolean } from 'react-hanger';

function App() {
    const drawerOpen = useBoolean(false);

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
          <TopBar onMenuClick={drawerOpen.toggle}/>
          App
          <Drawer anchor={'left'} open={drawerOpen.value} onClose={drawerOpen.setFalse}>
              {/* Dev Note : We add an empty 'Toolbar' so the drawer will start beneath the top bar*/}
              <Toolbar />
              Drawer
          </Drawer>
      </>
  );
}

export default App;
