import * as Logger from './logger';
import { Configuration } from './config';
import { StatusWriter } from './status';
import { Distributor } from './distributor';
import { TaskLoop } from './task-loop';
import { State } from './model/state';

export function run(config: Configuration) {
  const state = new State();
  const statusWriter = new StatusWriter(state, config);
  const distributor = new Distributor(state, config);

  const statusWriterTask = new TaskLoop(() => statusWriter.run(), config.StatusPollTimeSeconds * 1000);
  statusWriterTask.start();

  // service is now deprecated (logic moved to contracts) -> disabling the entire distributor task
  // const distributorTask = new TaskLoop(() => distributor.run(), config.DistributorWakeIntervalSeconds * 1000);
  // distributorTask.start();

  process.on('SIGINT', function () {
    Logger.log('Received SIGINT, shutting down.');
    statusWriterTask.stop();
    // distributorTask.stop();
    process.exit();
  });
}
