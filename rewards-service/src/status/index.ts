import _ from 'lodash';
import * as Logger from '../logger';
import { State, NUM_LAST_TRANSACTIONS } from '../model/state';
import { writeFileSync } from 'fs';
import { ensureFileDirectoryExists, JsonResponse, getCurrentClockTime, sleep } from '../helpers';
import { Configuration } from '../config';

const HISTORY_BATCH_TIME_ALLOWED_DELAY = 60 * 60; // seconds
const DISTRIBUTION_MAX_DURATION = 2 * 24 * 60 * 60; // seconds

const timeOriginallyLaunched = getCurrentClockTime();

export class StatusWriter {
  constructor(private state: State, private config: Configuration) {}

  // single tick of the run loop
  async run() {
    const status: JsonResponse = {
      Status: getStatusText(this.state),
      Timestamp: new Date().toISOString(),
      Payload: {
        Uptime: getCurrentClockTime() - timeOriginallyLaunched,
        MemoryBytesUsed: process.memoryUsage().heapUsed,
        HistoryMaxProcessedBlock: this.state.HistoryMaxProcessedBlock,
        LastHistoryFetchTime: this.state.LastHistoryFetchTime,
        HistoryTotalAssignmentEvents: this.state.EventHistory?.assignmentEvents.length ?? 0,
        HistoryTotalDistributionEvents: this.state.EventHistory?.distributionEvents.length ?? 0,
        TimeToNextDistribution: this.state.TimeToNextDistribution,
        LastDistributions: this.state.LastDistributions,
        InProgressDistribution: this.state.InProgressDistribution,
        LastTransactions: this.state.LastTransactions,
        EthereumRequestStats: this.state.EthereumRequestStats,
        Config: this.config,
      },
    };

    // include error field if found errors
    const errorText = getErrorText(this.state, this.config);
    if (errorText) {
      status.Error = errorText;
    }

    // do the actual writing to local file
    const filePath = this.config.StatusJsonPath;
    ensureFileDirectoryExists(filePath);
    const content = JSON.stringify(status, null, 2);
    writeFileSync(filePath, content);

    // log progress
    Logger.log(`Wrote status JSON to ${filePath} (${content.length} bytes).`);
    await sleep(0); // for eslint
  }
}

// helpers

function getStatusText(state: State) {
  const res = [];
  const now = getCurrentClockTime();
  const historyBatchAgo = now - state.LastHistoryFetchTime;
  res.push(`history block = ${state.HistoryMaxProcessedBlock} (updated ${historyBatchAgo} sec ago)`);
  res.push(`next distribution in ${state.TimeToNextDistribution} sec`);
  if (state.LastTransactions.length > 0) {
    res.push(`last tx status = ${state.LastTransactions[state.LastTransactions.length - 1].Status}`);
  }
  return res.join(', ');
}

function getErrorText(state: State, config: Configuration) {
  const res = [];
  const now = getCurrentClockTime();
  const historyBatchAgo = now - state.LastHistoryFetchTime;
  if (historyBatchAgo > HISTORY_BATCH_TIME_ALLOWED_DELAY) {
    res.push(`History last update time is too old (${historyBatchAgo} sec ago).`);
  }
  const numUnsuccessfulTx = _.reduce(
    state.LastTransactions,
    (sum, tx) => sum + (tx.Status != 'pending' && tx.Status != 'successful' ? 1 : 0),
    0
  );
  if (numUnsuccessfulTx >= Math.round(NUM_LAST_TRANSACTIONS / 2)) {
    res.push(`Too many unsuccessful transactions (${numUnsuccessfulTx}).`);
  }
  const latestDistributionStartTime = _.reduce(
    state.LastDistributions,
    (max, dist) => Math.max(max, dist.StartTime),
    0
  );
  const deltaFromLatestStart = now - latestDistributionStartTime;
  if (deltaFromLatestStart > config.DistributionFrequencySeconds + DISTRIBUTION_MAX_DURATION) {
    res.push(`Too much time passed from last distribution (${deltaFromLatestStart} sec).`);
  }
  return res.join(' ');
}
