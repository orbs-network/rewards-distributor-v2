import React from 'react';
import GaugeChart from 'react-gauge-chart'

interface IProps {
   lowestBlock: number;
   highestBlock: number;
   currentSyncedBlock: number;
}

export const SyncGauge = React.memo<IProps>(props => {
   const { lowestBlock, highestBlock, currentSyncedBlock } = props;

   const range = highestBlock - lowestBlock;
   const completePart = currentSyncedBlock - lowestBlock;
   const percentage = completePart / range;

   return <GaugeChart id="gauge-chart6"
                      animate={true}
                      textColor={'black'}
                      formatTextValue={(val) => "%" + val}
                      nrOfLevels={30}
                      percent={percentage}
                      // needleColor="#345243"
                      colors={['#EA4228' , '#F5CD19', '#5BE12C']}
                      arcPadding={0.02}

   />
});