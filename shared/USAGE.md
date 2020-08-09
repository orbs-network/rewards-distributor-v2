# Example usage of the shared library

The library is run from the point of view of a specific guardian who is distributing rewards. Their Ethereum address is `guardianAddress`.

## Step 1: Create a history downloader

```js
import { HistoryDownloader } from 'rewards-v2';

const guardianAddress = '0x16fcF728F8dc3F687132f2157D8379c021a08C12';
const historyDownloader = new HistoryDownloader(guardianAddress);

// enter the correct contracts addresses here
const genesisContractAddress = '0x6333c9549095651fCc8252345d6898208eBE8aaa'; // just an example, use the official address
const genesisBlockNumber = 0; // ethereum block number when Orbs PoS contracts were deployed
historyDownloader.setGenesisContract(web3, genesisContractAddress, genesisBlockNumber);
```

## Step 2: Download the history

```js
// we're going to download history up to this point
const latestEthereumBlock = await web3.eth.getBlockNumber();

let maxProcessedBlock = 0;
while (maxProcessedBlock < latestEthereumBlock) {
  maxProcessedBlock = await historyDownloader.processNextBlock(latestEthereumBlock);
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
let distribution = Distribution.getLastDistribution(latestEthereumBlock, history);
if (distribution == null || distribution.isDistributionComplete()) {
  distribution = Distribution.startNewDistribution(latestEthereumBlock, split, history);
}

// present the intended division (who gets what)
console.log(distribution.division);
```

## Step 4: Send distribution transactions

```js
// do this before every distribution since contracts may be updated
distribution.setRewardsContract(web3, history.contractAddresses.rewards);

const numRecipientsPerTx = 10;
const numConfirmations = 4;
const confirmationTimeoutSeconds = 600;
const progressCallback = (progress: number, confirmations: number) => {
  // present progress to users as transactions are confirmed
  console.log(`progress: ${progress * 100}% - ${confirmations} confirmations received`);
};

// all arguments are optional and have sensible defaults
const batch = distribution.prepareTransactionBatch(numRecipientsPerTx);

// present the intended transactions we want to send
console.log(batch);

// do the actual sending
const { isComplete, txHashes } = await distribution.sendTransactionBatch(
  batch, 
  numConfirmations,
  confirmationTimeoutSeconds,
  progressCallback
);

// present the transaction hashes
console.log(txHashes);
```

## Step 1 Alternative: History downloader with data about all guardians

This is useful for UI tools that show network-wide statistics and analytics. Normally, the history downloader only cares about the delegate doing the distribution. In this mode, it will download history for everybody.

```js
// when creating, add 'true' at the last argument
const historyDownloader = new HistoryDownloader(guardianAddress, true);

// after downloading the history (step 2), present the historic data
const historyPerDelegate = historyDownloader.extraHistoryPerDelegate;
for (const [delegateAddress, delegateHistory] of Object.entries(historyPerDelegate)) {
  console.log(delegateAddress, delegateHistory);
}
```
