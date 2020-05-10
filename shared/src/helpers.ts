import BN from 'bn.js';
import BigNumber from 'bignumber.js';

BigNumber.config({ DECIMAL_PLACES: 20 });

export function divideAsNumber(a: BN, b: BN): number {
  const aa = new BigNumber(a.toString());
  const bb = new BigNumber(b.toString());
  return aa.dividedBy(bb).toNumber();
}
