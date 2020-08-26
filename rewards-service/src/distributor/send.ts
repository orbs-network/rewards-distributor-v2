import _ from 'lodash';
import Web3 from 'web3';
import Signer from 'orbs-signer-client';
import * as Logger from '../logger';
import { TransactionBatch, Distribution } from 'rewards-v2';
import { jsonStringifyComplexTypes, getCurrentClockTime, sleep, toNumber } from '../helpers';
import { State, EthereumTxStatus, GasPriceStrategy, NUM_LAST_TRANSACTIONS } from '../model/state';
import { distributionName } from './helpers';
import { TransactionConfig } from 'web3-core';

const GAS_LIMIT_ESTIMATE_EXTRA = 100000;
const GAS_LIMIT_HARD_LIMIT = 2000000;

export interface EthereumTxParams {
  SignerEndpoint: string;
  NodeOrbsAddress: string;
  EthereumPendingTxPollTimeSeconds: number;
  EthereumDiscountGasPriceFactor: number;
  EthereumDiscountTxTimeoutSeconds: number;
  EthereumNonDiscountTxTimeoutSeconds: number;
  EthereumMaxGasPrice: number;
}

export async function sendTransactionBatch(
  batch: TransactionBatch,
  distribution: Distribution,
  signer: Signer,
  state: State,
  config: EthereumTxParams
) {
  const web3 = distribution.ethereum?.web3;
  if (!web3) throw new Error(`web3 is undefined, did you call setRewardsContract?`);
  const contract = distribution.ethereum?.rewardsContract;
  if (!contract) throw new Error(`Ethereum rewards contract is undefined, did you call setRewardsContract?`);

  for (const txData of batch) {
    // we're handling the transactions to send slowly one at a time
    const gasPriceStrategy = getGasPriceStrategy(state.LastTransactions);
    const gasPrice = await calcGasPrice(web3, gasPriceStrategy, config);

    const txStatus: EthereumTxStatus = {
      DistributionName: distributionName(distribution),
      SendTime: getCurrentClockTime(),
      GasPriceStrategy: gasPriceStrategy,
      GasPrice: gasPrice,
      Status: 'pending',
      TxHash: '',
      EthBlock: 0,
      TxIndex: txData.txIndex,
      NumRecipients: txData.recipientAddresses.length,
      TotalAmount: txData.totalAmount.toString(),
    };
    state.LastTransactions.push(txStatus);
    state.LastTransactions = _.takeRight(state.LastTransactions, NUM_LAST_TRANSACTIONS);
    Logger.log(`Attempting to send transaction: ${JSON.stringify(txStatus)}.`);

    // sign and send the transaction
    try {
      const encodedAbi = contract.methods
        .distributeOrbsTokenStakingRewards(
          txData.totalAmount.toString(), // uint256 totalAmount
          distribution.firstBlock, // uint256 fromBlock
          distribution.lastBlock, // uint256 toBlock
          Math.round(distribution.split.fractionForDelegators * 100 * 1000), // uint split
          txData.txIndex, // uint txIndex
          txData.recipientAddresses, // address[] calldata to
          _.map(txData.amounts, (bn) => bn.toString()) // uint256[] calldata amounts
        )
        .encodeABI() as string;
      const contractAddress = contract.options.address;
      const senderAddress = `0x${config.NodeOrbsAddress}`;
      const txHash = await signAndSendTransaction(web3, signer, encodedAbi, contractAddress, senderAddress, gasPrice);
      txStatus.TxHash = txHash;
      Logger.log(`Transaction sent with txHash ${txHash}.`);
    } catch (err) {
      Logger.error(`Failed sending transaction: ${err.stack}`);
      txStatus.Status = 'failed-send';
    }

    // poll the transaction until we see if it's successful or not
    while (txStatus.Status == 'pending') {
      await sleep(config.EthereumPendingTxPollTimeSeconds * 1000);
      await readPendingTransactionStatus(web3, txStatus, config);
    }

    // unless successful, stop trying to send transactions for now
    if (txStatus.Status != 'successful') return;
  }
}

// helpers

function getGasPriceStrategy(lastTransactions: EthereumTxStatus[]): GasPriceStrategy {
  if (lastTransactions.length == 0) return 'discount';
  const previousTxStatus = lastTransactions[lastTransactions.length - 1];
  if (previousTxStatus.Status == 'successful') return 'discount';
  return 'recommended';
}

async function calcGasPrice(web3: Web3, strategy: GasPriceStrategy, config: EthereumTxParams): Promise<number> {
  const recommendedGasPrice = parseInt(await web3.eth.getGasPrice());
  if (recommendedGasPrice <= 0) {
    throw new Error(`Cannot retrieve recommended gas price.`);
  }

  let res = recommendedGasPrice;
  if (strategy == 'discount') res = Math.round(config.EthereumDiscountGasPriceFactor * recommendedGasPrice);
  if (res > config.EthereumMaxGasPrice) {
    Logger.error(`Gas price ${res} surpassed maximum allowed ${config.EthereumMaxGasPrice}.`);
    res = config.EthereumMaxGasPrice;
  }
  return res;
}

async function signAndSendTransaction(
  web3: Web3,
  signer: Signer,
  encodedAbi: string,
  contractAddress: string,
  senderAddress: string,
  gasPrice: number
): Promise<string> {
  const nonce = await web3.eth.getTransactionCount(senderAddress, 'latest'); // ignore pending pool

  const txObject: TransactionConfig = {
    from: senderAddress,
    to: contractAddress,
    gasPrice: gasPrice,
    data: encodedAbi,
    nonce: nonce,
  };

  Logger.log(`About to estimate gas for tx object: ${jsonStringifyComplexTypes(txObject)}.`);

  let gasLimit = toNumber(await web3.eth.estimateGas(txObject));
  if (gasLimit <= 0) {
    throw new Error(`Cannot estimate gas for tx with data ${encodedAbi}.`);
  }
  gasLimit += GAS_LIMIT_ESTIMATE_EXTRA;
  if (gasLimit > GAS_LIMIT_HARD_LIMIT) {
    throw new Error(`Gas limit estimate ${gasLimit} over hard limit ${GAS_LIMIT_HARD_LIMIT}.`);
  }
  txObject.gas = gasLimit;

  Logger.log(`About to sign and send tx object: ${jsonStringifyComplexTypes(txObject)}.`);

  const { rawTransaction, transactionHash } = await signer.sign(txObject);
  if (!rawTransaction || !transactionHash) {
    throw new Error(`Could not sign tx object: ${jsonStringifyComplexTypes(txObject)}.`);
  }

  return new Promise<string>((resolve, reject) => {
    // normally this returns a promise that resolves on receipt, but we ignore this mechanism and have our own
    web3.eth
      .sendSignedTransaction(rawTransaction, (err) => {
        if (err) reject(err);
        else resolve(transactionHash);
      })
      .catch(() => {
        // do nothing (ignore the web3 promise)
      });
  });
}

async function readPendingTransactionStatus(web3: Web3, status: EthereumTxStatus, config: EthereumTxParams) {
  if (status.Status != 'pending') return;
  if (!status.TxHash) return;

  // needed since getTransactionReceipt fails on light client when tx is pending
  const tx = await web3.eth.getTransaction(status.TxHash);
  if (tx == null) {
    Logger.error(`Last ethereum tx ${status.TxHash} removed from pool.`);
    status.Status = 'removed-from-pool';
    return;
  }
  if (tx.blockNumber == null) {
    Logger.log(`Last ethereum tx ${status.TxHash} is still waiting for block.`);
    handlePendingTxTimeout(status, config);
    return; // still pending
  }
  const receipt = await web3.eth.getTransactionReceipt(status.TxHash);
  if (receipt == null) {
    Logger.log(`Last ethereum tx ${status.TxHash} does not have receipt yet.`);
    handlePendingTxTimeout(status, config);
    return; // still pending
  }

  // transaction is committed
  status.EthBlock = receipt.blockNumber;
  if (receipt.status) {
    Logger.log(`Last ethereum tx ${status.TxHash} was successful in block ${receipt.blockNumber}.`);
    status.Status = 'successful';
  } else {
    Logger.error(`Last ethereum tx ${status.TxHash} was reverted in block ${receipt.blockNumber}.`);
    status.Status = 'revert';
  }
}

function handlePendingTxTimeout(status: EthereumTxStatus, config: EthereumTxParams) {
  if (status.EthBlock > 0) return; // committed
  if (status.Status != 'pending') return;

  const now = getCurrentClockTime();
  const timeout =
    status.GasPriceStrategy == 'discount'
      ? config.EthereumDiscountTxTimeoutSeconds
      : config.EthereumNonDiscountTxTimeoutSeconds;
  if (now - status.SendTime > timeout) {
    Logger.error(`Last ethereum tx ${status.TxHash} timed out with gas price ${status.GasPrice}.`);
    status.Status = 'timeout';
  }
}
