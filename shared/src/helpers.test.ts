import BN from 'bn.js';
import { divideAsNumber } from './helpers';

it('divideAsNumber works', () => {
  expect(divideAsNumber(new BN(300), new BN(300))).toEqual(1);
  expect(divideAsNumber(new BN(300), new BN(600))).toEqual(0.5);
  expect(divideAsNumber(new BN(1), new BN(10000))).toEqual(0.0001);
  expect(divideAsNumber(new BN(37), new BN('2873427862873462378462'))).not.toEqual(0);
  expect(divideAsNumber(new BN(37), new BN('28734278628734623784628347786243876'))).toEqual(0);
});
