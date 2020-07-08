import * as Logger from './logger';
import { run } from '.';
import { parseArgs } from './cli-args';

process.on('uncaughtException', function (err) {
  Logger.log('Uncaught exception on process, shutting down:');
  Logger.error(err.stack);
  process.exit(1);
});

Logger.log('Service rewards-service started.');
const config = parseArgs(process.argv);
Logger.log(`Input config: '${JSON.stringify(config)}'.`);

try {
  run(config);
} catch (err) {
  Logger.log('Exception thrown from main.run, shutting down:');
  Logger.error(err.stack);
  process.exit(128);
}
