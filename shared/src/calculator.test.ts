import { EventHistory, Division } from './model';
import BN from 'bn.js';
import { Calculator } from './calculator';
import { DelegationsAccumulator } from './event-accumulator';

const getHistoryWithAssignments = () => {
  const h = new EventHistory('G1');
  h.startingBlock = 2;
  h.assignmentEvents.push({ block: 3, amount: new BN(100) });
  h.assignmentEvents.push({ block: 6, amount: new BN(200) });
  h.assignmentEvents.push({ block: 9, amount: new BN(300) });
  h.assignmentEvents.push({ block: 9, amount: new BN(400) });
  h.lastProcessedBlock = 12;
  return h;
};

describe('calcDivisionForSingleAssignment', () => {
  it('fails if out of bounds', () => {
    expect(() => {
      const h = getHistoryWithAssignments();
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(-5, { fractionForDelegators: 0.7 }, d, h);
    }).toThrow();
    expect(() => {
      const h = getHistoryWithAssignments();
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(5, { fractionForDelegators: 0.7 }, d, h);
    }).toThrow();
  });

  it('can split the entire amount to the delegate', () => {
    const h = getHistoryWithAssignments();
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: 0 }, d, h);
    expect(division.amountForDelegate).toEqual(new BN(100));
  });

  it('fails if the split fraction is illegal', () => {
    expect(() => {
      const h = getHistoryWithAssignments();
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: -0.1 }, d, h);
    }).toThrow();
    expect(() => {
      const h = getHistoryWithAssignments();
      const d = new DelegationsAccumulator(h);
      Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: 1.1 }, d, h);
    }).toThrow();
  });

  const getHistoryWithEverythingForSimpleAssignment = () => {
    const h = new EventHistory('G1');
    h.startingBlock = 1;
    // assignments
    h.assignmentEvents.push({ block: 5, amount: new BN(10000) });
    h.assignmentEvents.push({ block: 10, amount: new BN(20000) });
    h.assignmentEvents.push({ block: 11, amount: new BN(30000) });
    h.assignmentEvents.push({ block: 11, amount: new BN(40000) });
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
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(0, { fractionForDelegators: 0.6 }, d, h);
    // Total=10000 0.6*Total=6000 G1=4000
    // Blk01: Amount=6000/5=1200 D1=1200(100%=1200)
    // Blk02: Amount=6000/5=1200 D1=1000(50%=600) D2=1000(50%=600)
    // Blk03: Amount=6000/5=1200 D1=1000(50%=600) D2=1000(50%=600)
    // Blk04: Amount=6000/5=1200 D1=1000(25%=300) D2=1000(25%=300) D3=2000(50%=600)
    // Blk05: Amount=6000/5=1200 D2=1000(33%=400) D3=2000(66%=800)
    // Sums:
    // D1=1200+600+600+300=2700
    // D2=600+600+300+400=1900
    // D3=600+800=1400
    expect(division.amountForDelegate).toEqual(new BN(4000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(2700));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(1900));
    expect(division.amountsWithoutDelegate['D3']).toEqual(new BN(1400));
  });

  it('works on assignment index 1 blocks 6-10', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(1, { fractionForDelegators: 0.6 }, d, h);
    // Total=20000 0.6*Total=12000 G1=8000
    // Blk06: Amount=12000/5=2400 D1=0(0%) D2=1000(33.3%=800) D3=2000(66.6%=1600)
    // Blk07: Amount=12000/5=2400 D1=3000(50%=1200) D2=1000(16.6%=400) D3=2000(33.3%=800)
    // Blk08: Amount=12000/5=2400 D1=3000(50%=1200) D2=1000(16.6%=400) D3=2000(33.3%=800)
    // Blk09: Amount=12000/5=2400 D1=3000(50%=1200) D2=1000(16.6%=400) D3=2000(33.3%=800)
    // Blk10: Amount=12000/5=2400 D1=3000(37.5%=900) D2=1000(12.5%=300) D3=4000(50%=1200)
    // Sums:
    // D1=1200+1200+1200+900=4500
    // D2=800+400+400+400+300=2300
    // D3=1600+800+800+800+1200=5200
    expect(division.amountForDelegate).toEqual(new BN(8000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(4500));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(2300));
    expect(division.amountsWithoutDelegate['D3']).toEqual(new BN(5200));
  });

  it('works on assignment index 2 block 11', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(2, { fractionForDelegators: 0.6 }, d, h);
    // Total=30000 0.6*Total=18000 G1=12000
    // Blk11: Amount=18000 D1=3000(37.5%=6750) D2=1000(12.5%=2250) D3=4000(50%=9000)
    // Sums: just one block
    expect(division.amountForDelegate).toEqual(new BN(12000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(6750));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(2250));
    expect(division.amountsWithoutDelegate['D3']).toEqual(new BN(9000));
  });

  it('works on assignment index 3 block 11', () => {
    const h = getHistoryWithEverythingForSimpleAssignment();
    const d = new DelegationsAccumulator(h);
    const division = Calculator.calcDivisionForSingleAssignment(3, { fractionForDelegators: 0.6 }, d, h);
    // Total=40000 0.6*Total=24000 G1=16000
    // Blk11: Amount=24000 D1=3000(37.5%=9000) D2=1000(12.5%=3000) D3=4000(50%=12000)
    // Sums: just one block
    expect(division.amountForDelegate).toEqual(new BN(16000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(9000));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(3000));
    expect(division.amountsWithoutDelegate['D3']).toEqual(new BN(12000));
  });
});

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
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      2,
      1,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      3,
      2,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      4,
      3,
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
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      2,
      1,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      3,
      2,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenNthCalledWith(
      4,
      3,
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('sums results from multiple calcDivisionForSingleAssignment', () => {
    const spy = jest.spyOn(Calculator, 'calcDivisionForSingleAssignment');
    spy.mockImplementationOnce(() => {
      return {
        amountForDelegate: new BN(1),
        amountsWithoutDelegate: { D1: new BN(10), D2: new BN(20) },
      };
    });
    spy.mockImplementationOnce(() => {
      return {
        amountForDelegate: new BN(2),
        amountsWithoutDelegate: { D2: new BN(30), D3: new BN(40), D4: new BN(50) },
      };
    });
    spy.mockImplementationOnce(() => {
      return {
        amountForDelegate: new BN(3),
        amountsWithoutDelegate: { D2: new BN(60), D3: new BN(100) },
      };
    });
    const d = Calculator.calcDivisionForBlockPeriod(6, 9, { fractionForDelegators: 0.7 }, getHistoryWithAssignments());
    expect(Calculator.calcDivisionForSingleAssignment).toHaveBeenCalledTimes(3);
    expect(d.amountForDelegate).toEqual(new BN(6));
    expect(Object.keys(d.amountsWithoutDelegate).length).toEqual(4);
    expect(d.amountsWithoutDelegate['D1']).toEqual(new BN(10));
    expect(d.amountsWithoutDelegate['D2']).toEqual(new BN(110));
    expect(d.amountsWithoutDelegate['D3']).toEqual(new BN(140));
    expect(d.amountsWithoutDelegate['D4']).toEqual(new BN(50));
  });
});

const getDivisionWithIndivisibleTotal = () => {
  const d: Division = {
    amountForDelegate: new BN(1000),
    amountsWithoutDelegate: {
      D1: new BN(453),
      D2: new BN(1202),
    },
  };
  return d; // granularity = 1000
};

const getDivisionWithDivisibleTotal = () => {
  const d: Division = {
    amountForDelegate: new BN(1901),
    amountsWithoutDelegate: {
      D1: new BN(1000),
      D2: new BN(315),
      D3: new BN(2732),
      D4: new BN(1052),
      D5: new BN(0),
    },
  };
  return d; // granularity = 1000
};

const getDivisionWithoutResidue = () => {
  const d: Division = {
    amountForDelegate: new BN(2000),
    amountsWithoutDelegate: {
      D1: new BN(1000),
      D2: new BN(0),
    },
  };
  return d; // granularity = 1000
};

describe('fixDivisionGranularity', () => {
  it('fails if the division total is not divisible by granularity', () => {
    const d = getDivisionWithIndivisibleTotal();
    expect(() => {
      Calculator.fixDivisionGranularity(d, new BN(1000));
    }).toThrow();
  });

  it('gives residue to existing and floors everybody else', () => {
    const d = getDivisionWithDivisibleTotal();
    const division = Calculator.fixDivisionGranularity(d, new BN(1000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(1000));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(0));
    expect(division.amountsWithoutDelegate['D3']).toEqual(new BN(2000));
    expect(division.amountsWithoutDelegate['D4']).toEqual(new BN(1000));
    expect(division.amountsWithoutDelegate['D5']).toEqual(new BN(0));
    expect(division.amountForDelegate).toEqual(new BN(3000));
  });

  it('gives residue to zero delegate and floors everybody else', () => {
    const d = getDivisionWithDivisibleTotal();
    d.amountsWithoutDelegate['D9'] = d.amountForDelegate;
    d.amountForDelegate = new BN(0);
    const division = Calculator.fixDivisionGranularity(d, new BN(1000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(1000));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(0));
    expect(division.amountsWithoutDelegate['D3']).toEqual(new BN(2000));
    expect(division.amountsWithoutDelegate['D4']).toEqual(new BN(1000));
    expect(division.amountsWithoutDelegate['D5']).toEqual(new BN(0));
    expect(division.amountsWithoutDelegate['D9']).toEqual(new BN(1000));
    expect(division.amountForDelegate).toEqual(new BN(2000));
  });

  it('handles no residue when giving to existing', () => {
    const d = getDivisionWithoutResidue();
    const division = Calculator.fixDivisionGranularity(d, new BN(1000));
    expect(division.amountForDelegate).toEqual(new BN(2000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(1000));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(0));
  });

  it('handles no residue when giving to zero delegate', () => {
    const d = getDivisionWithoutResidue();
    d.amountsWithoutDelegate['D9'] = d.amountForDelegate;
    d.amountForDelegate = new BN(0);
    const division = Calculator.fixDivisionGranularity(d, new BN(1000));
    expect(division.amountsWithoutDelegate['D9']).toEqual(new BN(2000));
    expect(division.amountsWithoutDelegate['D1']).toEqual(new BN(1000));
    expect(division.amountsWithoutDelegate['D2']).toEqual(new BN(0));
    expect(division.amountForDelegate).toEqual(new BN(0));
  });
});

describe('splitAmountInProportionWithGranularity', () => {
  it('works', () => {
    expect(
      Calculator.splitAmountInProportionWithGranularity(new BN(2000), new BN(4444), new BN(8888), new BN(1000))
    ).toEqual(new BN(1000));
    expect(
      Calculator.splitAmountInProportionWithGranularity(new BN(20000), new BN(4444), new BN(8888), new BN(1000))
    ).toEqual(new BN(10000));
    expect(
      Calculator.splitAmountInProportionWithGranularity(new BN(200), new BN(4444), new BN(8888), new BN(1000))
    ).toEqual(new BN(0));
    expect(
      Calculator.splitAmountInProportionWithGranularity(new BN(2222), new BN(4444), new BN(8888), new BN(1000))
    ).toEqual(new BN(1000));
    expect(
      Calculator.splitAmountInProportionWithGranularity(new BN(2017), new BN(0), new BN(8888), new BN(1000))
    ).toEqual(new BN(0));
  });
});
