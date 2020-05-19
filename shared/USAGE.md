# Example usage of the shared library

The library is run from the point of view of a specific delegate who is distributing rewards. Their Ethereum address is `delegateAddress`.

## Step 1: Create a history downloader

```js
import { HistoryDownloader } from 'rewards-v2';

const genesisBlockNumber = 0; // ethereum block number earlier than when Orbs PoS contracts deployed
const delegateAddress = '0x16fcF728F8dc3F687132f2157D8379c021a08C12';

// we're going to download history up to this point
const latestEthereumBlock = await web3.eth.getBlockNumber();

const historyDownloader = new HistoryDownloader(guardianAddress, genesisBlockNumber);

// enter the correct contracts addresses here
historyDownloader.setEthereumContracts(web3, {
  Committee: '0x550f66F3248aa594376638277F0290D462C9Df9E',
  StakingRewards: '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc'
});
```

## Step 2: Download the history

```js
const numBlocksPerBatch = 1000;

let maxProcessedBlock = 0;
while (maxProcessedBlock < latestEthereumBlock) {
  maxProcessedBlock = await historyDownloader.processNextBatch(numBlocksPerBatch, latestEthereumBlock);
}

// present the historic data
console.log(historyDownloader.history);
```

## Step 3: Create a distribution event

```js
import { Distribution } from 'rewards-v2';

const history = historyDownloader.history;
const split = { fractionForDelegators: 0.7 }; // delegate gives 70% to delegators

// we may have an unfinished one that we must finish
let distribution = Distribution.getLast(latestEthereumBlock, history);
if (distribution == null) {
  distribution = Distribution.startNew(latestEthereumBlock, split, history);
}

// present the intended division (who gets what)
console.log(distribution.division);

// enter the correct contracts addresses here
distribution.setEthereumContracts(web3, {
  StakingRewards: '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc'
});
```

## Step 4: Send distribution transactions

```js
let done = false;
while (!done) {
  const { isComplete, receipt } = await distribution.sendNextTransaction();
  console.log(receipt);
  done = isComplete;
}
```