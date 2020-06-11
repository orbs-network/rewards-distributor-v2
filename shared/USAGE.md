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
  Delegations: '0x6333c9549095651fCc8252345d6898208eBE8aaa',
  Rewards: '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc'
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
  Rewards: '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc'
});
```

## Step 4: Send distribution transactions

```js
const numRecipientsPerTx = 10;
const numConfirmations = 4;
const confirmationTimeoutSeconds = 600;
const progressCallback = (progress: number, confirmations: number) => {
  // present progress to users as transactions are confirmed
  console.log(`progress: ${progress * 100}% - ${confirmations} confirmations received`);
};

// all arguments are optional and have sensible defaults
const { isComplete, txHashes } = await distribution.sendTransactionBatch(
  numRecipientsPerTx, 
  numConfirmations,
  confirmationTimeoutSeconds,
  progressCallback
);

// present the transaction hashes
console.log(txHashes);
```

## Step 1 Alternative: History downloader with data about all delegates

This is useful for UI tools that show network-wide statistics and analytics. Normally, the history downloader only cares about the delegate doing the distribution. In this mode, it will download history for everybody.

```js
// when creating, add 'true' at the last argument
const historyDownloader = new HistoryDownloader(guardianAddress, genesisBlockNumber, true);

// after downloading the history (step 2), present the historic data
const historyPerDelegate = historyDownloader.extraHistoryPerDelegate;
for (const [delegateAddress, delegateHistory] of Object.entries(historyPerDelegate)) {
  console.log(delegateAddress, delegateHistory);
}
```

## Step 2 Alternative: Download the history with autoscaling window size

This experimental mode attempts to optimize history downloading by using a variable window size that autoscales and shrinks with errors (like too many events in window). Example also shows more robust error handling and retries.

```js
// all options have defaults and are optional
const autoscaleOptions = {
  startWindow: 10000,
  maxWindow: 500000,
  minWindow: 50,
  windowGrowFactor: 2,
  windowGrowAfter: 20,
  windowShrinkFactor: 2,
};

let maxProcessedBlock = 0;
while (maxProcessedBlock < latestEthereumBlock) {
  try {
    maxProcessedBlock = await historyDownloader.processNextBatchAutoscale(latestEthereumBlock, autoscaleOptions);
  } catch (e) {
    if (historyDownloader.autoscaleConsecutiveFailures >= 2) {
      console.log('failing too often, trying again in 5 seconds');
      await sleep(5000);
    }
  }
}

// present the historic data
console.log(historyDownloader.history);
```
