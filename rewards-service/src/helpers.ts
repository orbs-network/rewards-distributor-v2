import _ from 'lodash';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureFileDirectoryExists(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

// returns UTC clock time in seconds (similar to unix timestamp / Ethereum block time / RefTime)
export function getCurrentClockTime() {
  return Math.round(new Date().getTime() / 1000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonResponse = any;

export function jsonStringifyComplexTypes(obj: unknown): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (key == 'privateKey') return '<redacted>';
      if (typeof value === 'bigint') return `BigInt(${value.toString()})`;
      if (typeof value == 'object') {
        if (value.constructor === Uint8Array) return `Uint8Array(${Buffer.from(value).toString('hex')})`;
      }
      return value; // return everything else unchanged
    },
    2
  );
}
