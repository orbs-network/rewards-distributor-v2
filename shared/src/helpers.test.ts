import BN from 'bn.js';
import { bnDivideAsNumber, bnMultiplyByNumber } from './helpers';

describe('divideAsNumber', () => {
  it('works', () => {
    expect(bnDivideAsNumber(new BN(300), new BN(300))).toEqual(1);
    expect(bnDivideAsNumber(new BN(300), new BN(600))).toEqual(0.5);
    expect(bnDivideAsNumber(new BN(1), new BN(10000))).toEqual(0.0001);
    expect(bnDivideAsNumber(new BN(37), new BN('2873427862873462378462'))).not.toEqual(0);
    expect(bnDivideAsNumber(new BN(37), new BN('28734278628734623784628347786243876'))).toEqual(0);
  });
});

describe('multiplyByNumber', () => {
  it('works', () => {
    expect(bnMultiplyByNumber(new BN(100), 1)).toEqual(new BN(100));
    expect(bnMultiplyByNumber(new BN(100), 0)).toEqual(new BN(0));
    expect(bnMultiplyByNumber(new BN(100), 0.17)).toEqual(new BN(17));
    expect(bnMultiplyByNumber(new BN(100), 0.1723)).toEqual(new BN(17));
    expect(bnMultiplyByNumber(new BN(100), 0.1789)).toEqual(new BN(18));
    expect(bnMultiplyByNumber(new BN(100), 0.175)).toEqual(new BN(18));
    expect(bnMultiplyByNumber(new BN('1000000000000000000000000000000000'), 0.5)).toEqual(
      new BN('500000000000000000000000000000000')
    );
  });
});
