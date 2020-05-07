import { EventHistory } from './history';
import { CommitteeAccumulator, DelegationsAccumulator } from './accumulator';
import BN from 'bn.js';

const getEmptyBlockHistory = (size: number) => {
  const h = new EventHistory('G1');
  h.lastProcessedBlock = size;
  return h;
}

const getHistoryWithCommitteeChanges = () => {
  const h = new EventHistory('G1');
  h.committeeChangeEvents.push({block: 2, newRelativeWeightInCommittee: 0.5});
  h.committeeChangeEvents.push({block: 4, newRelativeWeightInCommittee: 0.3});
  h.committeeChangeEvents.push({block: 5, newRelativeWeightInCommittee: 0.7});
  h.committeeChangeEvents.push({block: 8, newRelativeWeightInCommittee: 0.1});
  h.committeeChangeEvents.push({block: 8, newRelativeWeightInCommittee: 0.2});
  h.lastProcessedBlock = 10;
  return h;
}

it('CommitteeAccumulator fails if out of bounds', () => {
  const a = new CommitteeAccumulator(getEmptyBlockHistory(10));
  expect(() => {
    a.forBlock(11);
  }).toThrow();
});

it('CommitteeAccumulator returns zero if no events', () => {
  const a = new CommitteeAccumulator(getEmptyBlockHistory(10));
  expect(a.forBlock(6)).toEqual(0);
});

it('CommitteeAccumulator returns correct value when reached', () => {
  const a = new CommitteeAccumulator(getHistoryWithCommitteeChanges());
  expect(a.forBlock(1)).toEqual(0);
  expect(a.forBlock(2)).toEqual(0.5);
  expect(a.forBlock(3)).toEqual(0.5);
  expect(a.forBlock(4)).toEqual(0.3);
  expect(a.forBlock(5)).toEqual(0.7);
  expect(a.forBlock(6)).toEqual(0.7);
  expect(a.forBlock(7)).toEqual(0.7);
  expect(a.forBlock(8)).toEqual(0.2);
  expect(a.forBlock(9)).toEqual(0.2);
});

it('CommitteeAccumulator returns same value when called multiple times on same block', () => {
  const a = new CommitteeAccumulator(getHistoryWithCommitteeChanges());
  expect(a.forBlock(6)).toEqual(0.7);
  expect(a.forBlock(6)).toEqual(0.7);
  expect(a.forBlock(6)).toEqual(0.7);
});

it('CommitteeAccumulator fails if going backwards in blocks', () => {
  const a = new CommitteeAccumulator(getHistoryWithCommitteeChanges());
  expect(a.forBlock(5)).toEqual(0.7);
  expect(() => {
    a.forBlock(4);
  }).toThrow();
});

const getHistoryWithDelegationChanges = () => {
  const h = new EventHistory('G1');
  h.delegationChangeEvents.push({block: 2, delegatorAddress: 'D1', newDelegatedStake: new BN(100)});
  h.delegationChangeEvents.push({block: 4, delegatorAddress: 'D2', newDelegatedStake: new BN(300)});
  h.delegationChangeEvents.push({block: 6, delegatorAddress: 'D1', newDelegatedStake: new BN(200)});
  h.delegationChangeEvents.push({block: 7, delegatorAddress: 'D3', newDelegatedStake: new BN(500)});
  h.delegationChangeEvents.push({block: 8, delegatorAddress: 'D2', newDelegatedStake: new BN(0)});
  h.delegationChangeEvents.push({block: 8, delegatorAddress: 'D1', newDelegatedStake: new BN(300)});
  h.delegationChangeEvents.push({block: 10, delegatorAddress: 'D1', newDelegatedStake: new BN(0)});
  h.delegationChangeEvents.push({block: 10, delegatorAddress: 'D3', newDelegatedStake: new BN(0)});
  h.lastProcessedBlock = 12;
  return h;
}

it('DelegationsAccumulator fails if out of bounds', () => {
  const a = new DelegationsAccumulator(getEmptyBlockHistory(10));
  expect(() => {
    a.forBlock(11);
  }).toThrow();
});

it('DelegationsAccumulator returns zero if no events', () => {
  const a = new DelegationsAccumulator(getEmptyBlockHistory(10));
  expect(a.forBlock(6)).toEqual({
    stake: {},
    relativeWeight: {}
  });
});

it('DelegationsAccumulator returns correct value when reached', () => {
  const a = new DelegationsAccumulator(getHistoryWithDelegationChanges());
  expect(a.forBlock(1)).toEqual({
    stake: {},
    relativeWeight: {}
  });
  expect(a.forBlock(2)).toEqual({
    stake: {'D1': new BN(100)},
    relativeWeight: {'D1': 1.0}
  });
  expect(a.forBlock(3)).toEqual({
    stake: {'D1': new BN(100)},
    relativeWeight: {'D1': 1.0}
  });
  expect(a.forBlock(4)).toEqual({
    stake: {'D1': new BN(100), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.25, 'D2': 0.75}
  });
  expect(a.forBlock(5)).toEqual({
    stake: {'D1': new BN(100), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.25, 'D2': 0.75}
  });
  expect(a.forBlock(6)).toEqual({
    stake: {'D1': new BN(200), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.4, 'D2': 0.6}
  });
  expect(a.forBlock(7)).toEqual({
    stake: {'D1': new BN(200), 'D2': new BN(300), 'D3': new BN(500)},
    relativeWeight: {'D1': 0.2, 'D2': 0.3, 'D3': 0.5}
  });
  expect(a.forBlock(8)).toEqual({
    stake: {'D1': new BN(300), 'D3': new BN(500)},
    relativeWeight: {'D1': 0.375, 'D3': 0.625}
  });
  expect(a.forBlock(9)).toEqual({
    stake: {'D1': new BN(300), 'D3': new BN(500)},
    relativeWeight: {'D1': 0.375, 'D3': 0.625}
  });
  expect(a.forBlock(10)).toEqual({
    stake: {},
    relativeWeight: {}
  });
});

it('DelegationsAccumulator returns same value when called multiple times on same block', () => {
  const a = new DelegationsAccumulator(getHistoryWithDelegationChanges());
  expect(a.forBlock(6)).toEqual({
    stake: {'D1': new BN(200), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.4, 'D2': 0.6}
  });
  expect(a.forBlock(6)).toEqual({
    stake: {'D1': new BN(200), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.4, 'D2': 0.6}
  });
  expect(a.forBlock(6)).toEqual({
    stake: {'D1': new BN(200), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.4, 'D2': 0.6}
  });
});

it('DelegationsAccumulator fails if going backwards in blocks', () => {
  const a = new DelegationsAccumulator(getHistoryWithDelegationChanges());
  expect(a.forBlock(6)).toEqual({
    stake: {'D1': new BN(200), 'D2': new BN(300)},
    relativeWeight: {'D1': 0.4, 'D2': 0.6}
  });
  expect(() => {
    a.forBlock(5);
  }).toThrow();
});
