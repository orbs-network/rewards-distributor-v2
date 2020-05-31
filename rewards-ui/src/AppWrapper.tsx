import React from 'react'
import App from "./App";
import { RecoilRoot } from 'recoil';

interface IProps {

}

export const AppWrapper = React.memo<IProps>((props) => {
  const {} = props;

  return (
      <RecoilRoot>
      <App/>
      </RecoilRoot>
  )
});
