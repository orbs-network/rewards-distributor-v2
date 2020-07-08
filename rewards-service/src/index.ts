import * as Logger from './logger';
import { sleep } from './helpers';
import { Configuration } from './config';
import { StatusWriter } from './tasks/status';
import { TaskLoop } from './task-loop';
import { State } from './model/state';

export function run(config: Configuration) {
  const state = new State();
  const statusWriter = new StatusWriter(state, config);

  const statusWriterTask = new TaskLoop(() => statusWriter.run(), config.StatusPollTimeSeconds * 1000);
  statusWriterTask.start();

  process.on('SIGINT', function () {
    Logger.log('Received SIGINT, shutting down.');
    statusWriterTask.stop();
    process.exit();
  });
}
