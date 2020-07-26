import BN from 'bn.js';
import BigNumber from 'bignumber.js';

// BN (which is what Ethereum's Web3 relies on) only supports integers
// BigNumber to the rescue to deal with floating point and other complicated big calculations

BigNumber.config({ DECIMAL_PLACES: 20 });

export const bnZero = new BN(0);

export function bnDivideAsNumber(a: BN, b: BN): number {
  const aa = new BigNumber(a.toString());
  const bb = new BigNumber(b.toString());
  const rr = aa.dividedBy(bb);
  return rr.toNumber();
}

export function bnMultiplyByNumber(a: BN, b: number): BN {
  const aa = new BigNumber(a.toString());
  const bb = new BigNumber(b);
  const rr = aa.multipliedBy(bb).decimalPlaces(0, BigNumber.ROUND_HALF_CEIL);
  return new BN(rr.toString(10));
}

export function bnAddZeroes(a: number, zeroes: number): BN {
  const aa = new BigNumber(a);
  const zz = new BigNumber(`1e${zeroes}`);
  return new BN(aa.multipliedBy(zz).toString(10));
}

export async function sleep(millis: number) {
  await new Promise((r) => setTimeout(r, millis));
}

// efficient binary search, returns -1 if not found
export function findLowestClosestIndexToBlock(block: number, events: { block: number }[]): number {
  if (events.length == 0) {
    return -1;
  }
  let left = 0;
  let right = events.length - 1;
  while (events[left].block < block) {
    if (events[right].block < block) {
      return -1;
    }
    let middle = Math.floor((left + right) / 2);
    if (events[middle].block >= block) {
      if (middle == right) middle--;
      right = middle;
    } else {
      if (middle == left) middle++;
      left = middle;
    }
  }
  return left;
}

export function normalizeAddress(address: string): string {
  if (!address) return address;
  address = address.toLowerCase();
  if (!address.startsWith('0x')) return `0x${address}`;
  return address;
}

BN.prototype.toJSON = function () {
  return this.toString(10);
};

export type DailyStatsData = { day: string; count: number }[];

export class DailyStats {
  private data: DailyStatsData = [];
  constructor(private daysToRemember = 7) {}
  add(num: number) {
    const day = this.today();
    if (this.data.length > 0 && this.data[this.data.length - 1].day == day) {
      this.data[this.data.length - 1].count += num;
    } else {
      this.data.push({ day, count: num });
    }
    if (this.data.length > this.daysToRemember) {
      this.data.splice(0, this.data.length - this.daysToRemember);
    }
  }
  today(): string {
    return new Date().toISOString().substr(0, 10);
  }
  getStats() {
    return this.data;
  }
}
