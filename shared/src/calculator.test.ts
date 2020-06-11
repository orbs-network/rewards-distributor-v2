import { EventHistory } from './history';
import BN from 'bn.js';
import { Calculator, Division } from './calculator';
import { CommitteeAccumulator, DelegationsAccumulator } from './accumulator';

const getHistoryWithAssignments = () => {
  const h = new EventHistory('G1', 2);
  h.assignmentEvents.push({ block: 3, amount: new BN(100) });
  h.assignmentEvents.push({ block: 6, amount: new BN(200) });
  h.assignmentEvents.push({ block: 9, amount: new BN(300) });
  h.assignmentEvents.push({ block: 9, amount: new BN(400) });
  h.lastProcessedBlock = 12;
  return h;
};

describe('calcDivisionForBlockPeriod', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('fails if out of bounds', () => {
    expect(() => {
      Calculator.calcDivisionForBlockPeriod(30, 40, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    }).toThrow();
    expect(() => {
      Calculator.calcDivisionForBlockPeriod(1, 40, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    }).toThrow();
    expect(() => {
      Calculator.calcDivisionForBlockPeriod(8, 3, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    }).toThrow();
  });

  it('does not call calcDivisionForSingleAssignment when no assignments in range', () => {
    jest.spyOn(Calculator, 'calcDivisionForSingleAssignment');
    Calculator.calcDivisionForBlockPeriod(7, 8, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(0);
    Calculator.calcDivisionForBlockPeriod(10, 12, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(0);
  });

  it('calls divideSingleAssignment only for partial assignments in range', () => {
    jest.spyOn(Calculator, 'calcDivisionForSingleAssignment');
    Calculator.calcDivisionForBlockPeriod(4, 6, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(1);
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      1,
      1,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('calls calcDivisionForSingleAssignment with correct assignments indexes on exact boundaries', () => {
    jest.spyOn(Calculator, 'calcDivisionForSingleAssignment');
    Calculator.calcDivisionForBlockPeriod(3, 9, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(4);
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      1,
      0,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      2,
      1,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      3,
      2,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      4,
      3,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('calls calcDivisionForSingleAssignment with correct assignments indexes on loose boundaries', () => {
    jest.spyOn(Calculator, 'calcDivisionForSingleAssignment');
    Calculator.calcDivisionForBlockPeriod(2, 11, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(4);
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      1,
      0,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      2,
      1,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      3,
      2,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      4,
      3,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('sums results from multiple calcDivisionForSingleAssignment', () => {
    const spy = jest.spyOn(Calculator, 'calcDivisionForSingleAssignment');
    spy.mockImplementationOnce(() => {
      return {
        amounts: { D1: new BN(10), D2: new BN(20) },
      };
    });
    spy.mockImplementationOnce(() => {
      return {
        amounts: { D2: new BN(30), D3: new BN(40), D4: new BN(50) },
      };
    });
    spy.mockImplementationOnce(() => {
      return {
        amounts: { D2: new BN(60), D3: new BN(100) },
      };
    });
    const d = Calculator.calcDivisionForBlockPeriod(6, 9, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(3);
    expect(Object.keys(d.amounts).length).toEqual(4);
    expect(d.amounts['D1']).toEqual(new BN(10));
    expect(d.amounts['D2']).toEqual(new BN(110));
    expect(d.amounts['D3']).toEqual(new BN(140));
    expect(d.amounts['D4']).toEqual(new BN(50));
  });
});

describe('calcDivisionForSingleAssignment', () => {
  it('fails if out of bounds', () => {
    expect(() => {
      const h = getHistoryWithAssignments();
      const c = new CommitteeAccumulator(h);
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(-5, { fractionForDelegators: 0.7 }, c, d, h);
    }).toThrow();
    expect(() => {
      const h = getHistoryWithAssignments();
      const c = new CommitteeAccumulator(h);
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(5, { fractionForDelegators: 0.7 }, c, d, h);
    }).toThrow();
  });

  it('can split the entire amount to the delegate', () => {
    const h = getHistoryWithAssignments();
    const c = new CommitteeAccumulator(h);
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: 0 }, c, d, h);
    expect(division.amounts['G1']).toEqual(new BN(100));
  });

  it('fails if the split fraction is illegal', () => {
    expect(() => {
      const h = getHistoryWithAssignments();
      const c = new CommitteeAccumulator(h);
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: -0.1 }, c, d, h);
    }).toThrow();
    expect(() => {
      const h = getHistoryWithAssignments();
      const c = new CommitteeAccumulator(h);
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: 1.1 }, c, d, h);
    }).toThrow();
  });

  const getHistoryWithEverythingForSimpleAssignment = () => {
    const h = new EventHistory('G1', 1);
    // assignments
    h.assignmentEvents.push({ block: 5, amount: new BN(10000) });
    h.assignmentEvents.push({ block: 10, amount: new BN(20000) });
    h.assignmentEvents.push({ block: 11, amount: new BN(30000) });
    h.assignmentEvents.push({ block: 11, amount: new BN(40000) });
    // committee changes
    h.committeeChangeEvents.push({ block: 1, newRelativeWeightInCommittee: 0.5 });
    h.committeeChangeEvents.push({ block: 5, newRelativeWeightInCommittee: 0 });
    h.committeeChangeEvents.push({ block: 6, newRelativeWeightInCommittee: 0.25 });
    h.committeeChangeEvents.push({ block: 8, newRelativeWeightInCommittee: 0.5 });
    // delegations
    h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D1', newDelegatedStake: new BN(1000) });
    h.delegationChangeEvents.push({ block: 2, delegatorAddress: 'D2', newDelegatedStake: new BN(1000) });
    h.delegationChangeEvents.push({ block: 4, delegatorAddress: 'D3', newDelegatedStake: new BN(2000) });
    h.delegationChangeEvents.push({ block: 5, delegatorAddress: 'D1', newDelegatedStake: new BN(0) });
    h.delegationChangeEvents.push({ block: 7, delegatorAddress: 'D1', newDelegatedStake: new BN(3000) });
    h.delegationChangeEvents.push({ block: 10, delegatorAddress: 'D3', newDelegatedStake: new BN(4000) });
    h.lastProcessedBlock = 12;
    return h;
  };

  it('works on assigment index 0 blocks 1-5', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const c = new CommitteeAccumulator(h);
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: 0.6 }, c, d, h);
    // Total=10000 0.6*Total=6000 G1=4000
    // Blk01: W=0.5(25%) Amount=6000/4=1500 D1=1000(100%=1500)
    // Blk02: W=0.5(25%) Amount=6000/4=1500 D1=1000(50%=750) D2=1000(50%=750)
    // Blk03: W=0.5(25%) Amount=6000/4=1500 D1=1000(50%=750) D2=1000(50%=750)
    // Blk04: W=0.5(25%) Amount=6000/4=1500 D1=1000(25%=375) D2=1000(25%=375) D3=2000(50%=750)
    // Blk05: W=0.0(00%) Amount=0 D2=1000 D3=2000
    // Sums:
    // D1=1500+750+750+375=3375
    // D2=750+750+375=1875
    // D3=750
    expect(division.amounts['G1']).toEqual(new BN(4000));
    expect(division.amounts['D1']).toEqual(new BN(3375));
    expect(division.amounts['D2']).toEqual(new BN(1875));
    expect(division.amounts['D3']).toEqual(new BN(750));
  });

  it('works on assignment index 1 blocks 6-10', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const c = new CommitteeAccumulator(h);
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(1, { fractionForDelegators: 0.6 }, c, d, h);
    // Total=20000 0.6*Total=12000 G1=8000
    // Blk06: W=0.25(12.5%) Amount=1500 D1=0(0%) D2=1000(33.3%=500) D3=2000(66.6%=1000)
    // Blk07: W=0.25(12.5%) Amount=1500 D1=3000(50%=750) D2=1000(16.6%=250) D3=2000(33.3%=500)
    // Blk08: W=0.50(25.0%) Amount=3000 D1=3000(50%=1500) D2=1000(16.6%=500) D3=2000(33.3%=1000)
    // Blk09: W=0.50(25.0%) Amount=3000 D1=3000(50%=1500) D2=1000(16.6%=500) D3=2000(33.3%=1000)
    // Blk10: W=0.50(25.0%) Amount=3000 D1=3000(37.5%=1125) D2=1000(12.5%=375) D3=4000(50%=1500)
    // Sums:
    // D1=750+1500+1500+1125=4875
    // D2=500+250+500+500+375=2125
    // D3=1000+500+1000+1000+1500=5000
    expect(division.amounts['G1']).toEqual(new BN(8000));
    expect(division.amounts['D1']).toEqual(new BN(4875));
    expect(division.amounts['D2']).toEqual(new BN(2125));
    expect(division.amounts['D3']).toEqual(new BN(5000));
  });

  it('works on assignment index 2 block 11', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const c = new CommitteeAccumulator(h);
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(2, { fractionForDelegators: 0.6 }, c, d, h);
    // Total=30000 0.6*Total=18000 G1=12000
    // Blk11: W=0.5(100%) Amount=18000 D1=3000(37.5%=6750) D2=1000(12.5%=2250) D3=4000(50%=9000)
    // Sums: just one block
    expect(division.amounts['G1']).toEqual(new BN(12000));
    expect(division.amounts['D1']).toEqual(new BN(6750));
    expect(division.amounts['D2']).toEqual(new BN(2250));
    expect(division.amounts['D3']).toEqual(new BN(9000));
  });

  it('works on assignment index 3 block 11', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const c = new CommitteeAccumulator(h);
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(3, { fractionForDelegators: 0.6 }, c, d, h);
    // Total=40000 0.6*Total=24000 G1=16000
    // Blk11: W=0.5(100%) Amount=24000 D1=3000(37.5%=9000) D2=1000(12.5%=3000) D3=4000(50%=12000)
    // Sums: just one block
    expect(division.amounts['G1']).toEqual(new BN(16000));
    expect(division.amounts['D1']).toEqual(new BN(9000));
    expect(division.amounts['D2']).toEqual(new BN(3000));
    expect(division.amounts['D3']).toEqual(new BN(12000));
  });
});

const getDivisionWithIndivisibleTotal = () => {
  const d: Division = { amounts: {} };
  d.amounts['G1'] = new BN(1000);
  d.amounts['D1'] = new BN(453);
  d.amounts['D2'] = new BN(1202);
  return d; // granularity = 1000
};

const getDivisionWithDivisibleTotal = () => {
  const d: Division = { amounts: {} };
  d.amounts['G1'] = new BN(1901);
  d.amounts['D1'] = new BN(1000);
  d.amounts['D2'] = new BN(315);
  d.amounts['D3'] = new BN(2732);
  d.amounts['D4'] = new BN(1052);
  d.amounts['D5'] = new BN(0);
  return d; // granularity = 1000
};

const getDivisionWithoutResidue = () => {
  const d: Division = { amounts: {} };
  d.amounts['G1'] = new BN(2000);
  d.amounts['D1'] = new BN(1000);
  d.amounts['D2'] = new BN(0);
  return d; // granularity = 1000
};

describe('fixDivisionGranularity', () => {
  it('fails if the division total is not divisible by granularity', () => {
    const d = getDivisionWithIndivisibleTotal();
    expect(() => {
      Calculator.fixDivisionGranularity(d, new BN(1000), 'G1');
    }).toThrow();
  });

  it('gives residue to existing and floors everybody else', () => {
    const d = getDivisionWithDivisibleTotal();
    const division = Calculator.fixDivisionGranularity(d, new BN(1000), 'G1');
    expect(division.amounts['D1']).toEqual(new BN(1000));
    expect(division.amounts['D2']).toEqual(new BN(0));
    expect(division.amounts['D3']).toEqual(new BN(2000));
    expect(division.amounts['D4']).toEqual(new BN(1000));
    expect(division.amounts['D5']).toEqual(new BN(0));
    expect(division.amounts['G1']).toEqual(new BN(3000));
  });

  it('gives residue to non-existing and floors everybody else', () => {
    const d = getDivisionWithDivisibleTotal();
    const division = Calculator.fixDivisionGranularity(d, new BN(1000), 'G2');
    expect(division.amounts['D1']).toEqual(new BN(1000));
    expect(division.amounts['D2']).toEqual(new BN(0));
    expect(division.amounts['D3']).toEqual(new BN(2000));
    expect(division.amounts['D4']).toEqual(new BN(1000));
    expect(division.amounts['D5']).toEqual(new BN(0));
    expect(division.amounts['G1']).toEqual(new BN(1000));
    expect(division.amounts['G2']).toEqual(new BN(2000));
  });

  it('handles no residue when giving to existing', () => {
    const d = getDivisionWithoutResidue();
    const division = Calculator.fixDivisionGranularity(d, new BN(1000), 'G1');
    expect(division.amounts['G1']).toEqual(new BN(2000));
    expect(division.amounts['D1']).toEqual(new BN(1000));
    expect(division.amounts['D2']).toEqual(new BN(0));
  });

  it('handles no residue when giving to non-existing', () => {
    const d = getDivisionWithoutResidue();
    const division = Calculator.fixDivisionGranularity(d, new BN(1000), 'G2');
    expect(division.amounts['G1']).toEqual(new BN(2000));
    expect(division.amounts['D1']).toEqual(new BN(1000));
    expect(division.amounts['D2']).toEqual(new BN(0));
    expect(division.amounts['G2']).toBeUndefined();
  });
});
