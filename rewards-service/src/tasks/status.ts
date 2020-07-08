import * as Logger from '../logger';
import { State } from '../model/state';
import { writeFileSync } from 'fs';
import { ensureFileDirectoryExists, JsonResponse, getCurrentClockTime, sleep } from '../helpers';
import { Configuration } from '../config';

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
        Config: this.config,
      },
    };

    // include error field if found errors
    const errorText = getErrorText(this.state);
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
  res.push();
  res.push(`temp`);
  return res.join(', ');
}

function getErrorText(state: State) {
  return '';
}
