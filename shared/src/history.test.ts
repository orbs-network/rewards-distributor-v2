import BN from 'bn.js';
import { findLowestClosestIndexToBlock, EventHistory } from './history';

it('findClosestIndexToBlock can match actual history events', () => {
  const h = new EventHistory('G1');
  h.assignmentEvents.push({ block: 3, amount: new BN(100) });
  h.assignmentEvents.push({ block: 7, amount: new BN(101) });
  h.assignmentEvents.push({ block: 12, amount: new BN(102) });
  h.lastProcessedBlock = 14;
  expect(findLowestClosestIndexToBlock(7, h.assignmentEvents)).toEqual(1);
});

it('findClosestIndexToBlock works', () => {
  // 0 elements
  expect(() => {
    findLowestClosestIndexToBlock(5, []);
  }).toThrow();
  // 1 element
  expect(findLowestClosestIndexToBlock(5, [{ block: 5 }])).toEqual(0);
  expect(() => {
    findLowestClosestIndexToBlock(5, [{ block: 1 }]);
  }).toThrow();
  expect(findLowestClosestIndexToBlock(5, [{ block: 9 }])).toEqual(0);
  // 2 elements
  expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 5 }])).toEqual(0);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 5 }])).toEqual(1);
  expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 9 }])).toEqual(0);
  expect(() => {
    findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }]);
  }).toThrow();
  expect(findLowestClosestIndexToBlock(5, [{ block: 8 }, { block: 9 }])).toEqual(0);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 9 }])).toEqual(1);
  // 3 elements
  expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 5 }, { block: 5 }])).toEqual(0);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 5 }, { block: 5 }])).toEqual(1);
  expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 5 }, { block: 9 }])).toEqual(0);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 5 }])).toEqual(2);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 5 }, { block: 9 }])).toEqual(1);
  expect(findLowestClosestIndexToBlock(5, [{ block: 5 }, { block: 8 }, { block: 9 }])).toEqual(0);
  expect(() => {
    findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 3 }]);
  }).toThrow();
  expect(findLowestClosestIndexToBlock(5, [{ block: 7 }, { block: 8 }, { block: 9 }])).toEqual(0);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 9 }])).toEqual(2);
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 8 }, { block: 9 }])).toEqual(1);
  // 4 elements
  expect(findLowestClosestIndexToBlock(5, [{ block: 1 }, { block: 2 }, { block: 8 }, { block: 9 }])).toEqual(2);
});
