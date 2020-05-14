import BN from 'bn.js';
import BigNumber from 'bignumber.js';

// BN (which is what Ethereum's Web3 relies on) only supports integers
// BigNumber to the rescue to deal with floating point

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
