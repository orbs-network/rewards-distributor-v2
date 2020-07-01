import { EventHistory } from './model';
import { CommitteeAccumulator, DelegationsAccumulator } from './event-accumulator';
import BN from 'bn.js';

const getEmptyBlockHistory = (size: number) => {
  const h = new EventHistory('G1', 0);
  h.lastProcessedBlock = size;
  return h;
};

const getHistoryWithCommitteeChanges = () => {
  const h = new EventHistory('G1', 0);
  h.committeeSnapshotEvents.push({ block: 2, newRelativeWeightInCommittee: 0.5 });
  h.committeeSnapshotEvents.push({ block: 4, newRelativeWeightInCommittee: 0.3 });
  h.committeeSnapshotEvents.push({ block: 5, newRelativeWeightInCommittee: 0.7 });
  h.committeeSnapshotEvents.push({ block: 8, newRelativeWeightInCommittee: 0.1 });
  h.committeeSnapshotEvents.push({ block: 8, newRelativeWeightInCommittee: 0.2 });
  h.lastProcessedBlock = 10;
  return h;
};

describe('CommitteeAccumulator', () => {
  it('fails if out of bounds', () => {
    const a = new CommitteeAccumulator(getEmptyBlockHistory(10));
    expect(() => {
      a.forBlock(11);
    }).toThrow();
  });

  it('returns zero if no events', () => {
    const a = new CommitteeAccumulator(getEmptyBlockHistory(10));
    expect(a.forBlock(6)).toEqual(0);
  });

  it('returns correct value when reached', () => {
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

  it('returns same value when called multiple times on same block', () => {
    const a = new CommitteeAccumulator(getHistoryWithCommitteeChanges());
    expect(a.forBlock(6)).toEqual(0.7);
    expect(a.forBlock(6)).toEqual(0.7);
    expect(a.forBlock(6)).toEqual(0.7);
  });

  it('fails if going backwards in blocks', () => {
    const a = new CommitteeAccumulator(getHistoryWithCommitteeChanges());
    expect(a.forBlock(5)).toEqual(0.7);
    expect(() => {
      a.forBlock(4);
    }).toThrow();
  });
});

const getHistoryWithDelegationChanges = () => {
  const h = new EventHistory('G1', 0);
  h.delegationChangeEvents.push({ block: 2, delegatorAddress: 'D1', newDelegatedStake: new BN(100) });
  h.delegationChangeEvents.push({ block: 4, delegatorAddress: 'D2', newDelegatedStake: new BN(300) });
  h.delegationChangeEvents.push({ block: 6, delegatorAddress: 'D1', newDelegatedStake: new BN(200) });
  h.delegationChangeEvents.push({ block: 7, delegatorAddress: 'D3', newDelegatedStake: new BN(500) });
  h.delegationChangeEvents.push({ block: 8, delegatorAddress: 'D2', newDelegatedStake: new BN(0) });
  h.delegationChangeEvents.push({ block: 8, delegatorAddress: 'D1', newDelegatedStake: new BN(300) });
  h.delegationChangeEvents.push({ block: 10, delegatorAddress: 'D1', newDelegatedStake: new BN(0) });
  h.delegationChangeEvents.push({ block: 10, delegatorAddress: 'D3', newDelegatedStake: new BN(0) });
  h.lastProcessedBlock = 12;
  return h;
};

describe('DelegationsAccumulator', () => {
  it('fails if out of bounds', () => {
    const a = new DelegationsAccumulator(getEmptyBlockHistory(10));
    expect(() => {
      a.forBlock(11);
    }).toThrow();
  });

  it('returns zero if no events', () => {
    const a = new DelegationsAccumulator(getEmptyBlockHistory(10));
    expect(a.forBlock(6)).toEqual({
      stake: {},
      relativeWeight: {},
    });
  });

  it('returns correct value when reached', () => {
    const a = new DelegationsAccumulator(getHistoryWithDelegationChanges());
    expect(a.forBlock(1)).toEqual({
      stake: {},
      relativeWeight: {},
    });
    expect(a.forBlock(2)).toEqual({
      stake: { D1: new BN(100) },
      relativeWeight: { D1: 1.0 },
    });
    expect(a.forBlock(3)).toEqual({
      stake: { D1: new BN(100) },
      relativeWeight: { D1: 1.0 },
    });
    expect(a.forBlock(4)).toEqual({
      stake: { D1: new BN(100), D2: new BN(300) },
      relativeWeight: { D1: 0.25, D2: 0.75 },
    });
    expect(a.forBlock(5)).toEqual({
      stake: { D1: new BN(100), D2: new BN(300) },
      relativeWeight: { D1: 0.25, D2: 0.75 },
    });
    expect(a.forBlock(6)).toEqual({
      stake: { D1: new BN(200), D2: new BN(300) },
      relativeWeight: { D1: 0.4, D2: 0.6 },
    });
    expect(a.forBlock(7)).toEqual({
      stake: { D1: new BN(200), D2: new BN(300), D3: new BN(500) },
      relativeWeight: { D1: 0.2, D2: 0.3, D3: 0.5 },
    });
    expect(a.forBlock(8)).toEqual({
      stake: { D1: new BN(300), D3: new BN(500) },
      relativeWeight: { D1: 0.375, D3: 0.625 },
    });
    expect(a.forBlock(9)).toEqual({
      stake: { D1: new BN(300), D3: new BN(500) },
      relativeWeight: { D1: 0.375, D3: 0.625 },
    });
    expect(a.forBlock(10)).toEqual({
      stake: {},
      relativeWeight: {},
    });
  });

  it('returns same value when called multiple times on same block', () => {
    const a = new DelegationsAccumulator(getHistoryWithDelegationChanges());
    expect(a.forBlock(6)).toEqual({
      stake: { D1: new BN(200), D2: new BN(300) },
      relativeWeight: { D1: 0.4, D2: 0.6 },
    });
    expect(a.forBlock(6)).toEqual({
      stake: { D1: new BN(200), D2: new BN(300) },
      relativeWeight: { D1: 0.4, D2: 0.6 },
    });
    expect(a.forBlock(6)).toEqual({
      stake: { D1: new BN(200), D2: new BN(300) },
      relativeWeight: { D1: 0.4, D2: 0.6 },
    });
  });

  it('fails if going backwards in blocks', () => {
    const a = new DelegationsAccumulator(getHistoryWithDelegationChanges());
    expect(a.forBlock(6)).toEqual({
      stake: { D1: new BN(200), D2: new BN(300) },
      relativeWeight: { D1: 0.4, D2: 0.6 },
    });
    expect(() => {
      a.forBlock(5);
    }).toThrow();
  });
});
