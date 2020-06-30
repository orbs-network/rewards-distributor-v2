import * as Logger from '../logger';
import { State } from '..';
import { writeFileSync } from 'fs';
import { ensureFileDirectoryExists, JsonResponse, getCurrentClockTime } from '../helpers';
import { Configuration } from '../config';

const timeOriginallyLaunched = getCurrentClockTime();

export function writeStatusToDisk(filePath: string, state: State, config: Configuration) {
  const status: JsonResponse = {
    Status: getStatusText(state),
    Timestamp: new Date().toISOString(),
    Payload: {
      Uptime: getCurrentClockTime() - timeOriginallyLaunched,
      Config: config,
    },
  };

  // include error field if found errors
  const errorText = getErrorText(state);
  if (errorText) {
    status.Error = errorText;
  }

  // do the actual writing to local file
  ensureFileDirectoryExists(filePath);
  const content = JSON.stringify(status, null, 2);
  writeFileSync(filePath, content);

  // log progress
  Logger.log(`Wrote status JSON to ${filePath} (${content.length} bytes).`);
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
