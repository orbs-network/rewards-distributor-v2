import BN from 'bn.js';
import {
  bnDivideAsNumber,
  bnMultiplyByNumber,
  bnAddZeroes,
  findLowestClosestIndexToBlock,
  normalizeAddress,
} from './helpers';
import { EventHistory } from './model';

describe('bnDivideAsNumber', () => {
  it('works', () => {
    expect(bnDivideAsNumber(new BN(300), new BN(300))).toEqual(1);
    expect(bnDivideAsNumber(new BN(300), new BN(600))).toEqual(0.5);
    expect(bnDivideAsNumber(new BN(1), new BN(10000))).toEqual(0.0001);
    expect(bnDivideAsNumber(new BN(37), new BN('2873427862873462378462'))).not.toEqual(0);
    expect(bnDivideAsNumber(new BN(37), new BN('28734278628734623784628347786243876'))).toEqual(0);
  });
});

describe('bnMultiplyByNumber', () => {
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

describe('bnAddZeroes', () => {
  it('works', () => {
    expect(bnAddZeroes(17, 2)).toEqual(new BN(1700));
    expect(bnAddZeroes(17, 15)).toEqual(new BN('17000000000000000'));
  });
});

describe('findClosestIndexToBlock', () => {
  it('can match actual history events', () => {
    const h = new EventHistory('G1', 0);
    h.assignmentEvents.push({ block: 3, amount: new BN(100) });
    h.assignmentEvents.push({ block: 7, amount: new BN(101) });
    h.assignmentEvents.push({ block: 12, amount: new BN(102) });
    h.lastProcessedBlock = 14;
    expect(findLowestClosestIndexToBlock(7, h.assignmentEvents)).toEqual(1);
  });

  it('works', () => {
    // 0 elements
    expect(findLowestClosestIndexToBlock(5, [])).toEqual(-1);
    // 1 element
    expect(findLowestClosestIndexToBlock(5, [{ block: 5 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }])).toEqual(-1);
    expect(findLowestClosestIndexToBlock(5, [{ block: 9 }])).toEqual(0);
    // 2 elements
    expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 5 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 5 }])).toEqual(1);
    expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 9 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }])).toEqual(-1);
    expect(findLowestClosestIndexToBlock(5, [{ block: 8 }, { block: 9 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 9 }])).toEqual(1);
    // 3 elements
    expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 5 }, { block: 5 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 5 }, { block: 5 }])).toEqual(1);
    expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 5 }, { block: 9 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 5 }])).toEqual(2);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 5 }, { block: 9 }])).toEqual(1);
    expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 8 }, { block: 9 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 3 }])).toEqual(-1);
    expect(findLowestClosestIndexToBlock(5, [{ block: 7 }, { block: 8 }, { block: 9 }])).toEqual(0);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 9 }])).toEqual(2);
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 8 }, { block: 9 }])).toEqual(1);
    // 4 elements
    expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 8 }, { block: 9 }])).toEqual(2);
  });
});

describe('normalizeAddress', () => {
  it('works', () => {
    expect(normalizeAddress('0x123abc')).toEqual('0x123abc');
    expect(normalizeAddress('0x123AbC')).toEqual('0x123abc');
    expect(normalizeAddress('123abc')).toEqual('0x123abc');
    expect(normalizeAddress('123AbC')).toEqual('0x123abc');
    expect(normalizeAddress('0X123ABC')).toEqual('0x123abc');
  });
});
