import * as Logger from './logger';
import { Configuration } from './config';
import { StatusWriter } from './tasks/status';
import { TaskLoop } from './task-loop';
import { State } from './model/state';
import { HistorySync } from './tasks/history-sync';

export function run(config: Configuration) {
  const state = new State();
  const statusWriter = new StatusWriter(state, config);
  const historySync = new HistorySync(state, config);

  const statusWriterTask = new TaskLoop(() => statusWriter.run(), config.StatusPollTimeSeconds * 1000);
  const historySyncTask = new TaskLoop(() => historySync.run(), config.HistoryPollIntervalSeconds * 1000);
  statusWriterTask.start();
  historySyncTask.start();

  process.on('SIGINT', function () {
    Logger.log('Received SIGINT, shutting down.');
    statusWriterTask.stop();
    historySyncTask.stop();
    process.exit();
  });
}
