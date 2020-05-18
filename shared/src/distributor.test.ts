import { EventHistory } from './history';
import { Distribution, TooManyRecipientsError } from './distributor';
import BN from 'bn.js';

const getEmptyBlockHistory = (size: number) => {
  const h = new EventHistory('G1', 1);
  h.lastProcessedBlock = size;
  return h;
};

const getHistoryWithSeveralDistributions = () => {
  const h = new EventHistory('G1', 1);
  h.distributionEvents.push({
    block: 6,
    recipientAddresses: ['D1'],
    amounts: [new BN(100)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.4 },
  });
  h.distributionEvents.push({
    block: 11,
    recipientAddresses: ['D2'],
    amounts: [new BN(400)],
    batchFirstBlock: 10,
    batchLastBlock: 15,
    batchTxIndex: 1,
    batchSplit: { fractionForDelegators: 0.6 },
  });
  h.distributionEvents.push({
    block: 11,
    recipientAddresses: ['D1'],
    amounts: [new BN(300)],
    batchFirstBlock: 10,
    batchLastBlock: 15,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.6 },
  });
  h.distributionEvents.push({
    block: 11,
    recipientAddresses: ['D1'],
    amounts: [new BN(200)],
    batchFirstBlock: 6,
    batchLastBlock: 9,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.7 },
  });
  h.lastProcessedBlock = 20;
  return h;
};

describe('getLast', () => {
  it('fails if out of bounds', () => {
    expect(() => {
      Distribution.getLast(11, getEmptyBlockHistory(10));
    }).toThrow();
    expect(() => {
      Distribution.getLast(9, getEmptyBlockHistory(10));
    }).toThrow();
  });

  it('returns null if no distribution', () => {
    expect(Distribution.getLast(10, getEmptyBlockHistory(10))).toBe(null);
  });

  it('returns last distribution even when several out of order in one block', () => {
    const d = Distribution.getLast(20, getHistoryWithSeveralDistributions());
    expect(d?.firstBlock).toEqual(10);
    expect(d?.lastBlock).toEqual(15);
    expect(d?.split).toEqual({ fractionForDelegators: 0.6 });
  });
});

const getHistoryWithCompleteDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['D1', 'G1'],
    amounts: [new BN(100), new BN(0)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 1,
    batchSplit: { fractionForDelegators: 1 },
  });
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['D2', 'D3'],
    amounts: [new BN(200), new BN(300)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 1 },
  });
  h.assignmentEvents.push({ block: 5, amount: new BN(600) });
  h.committeeChangeEvents.push({ block: 1, newRelativeWeightInCommittee: 0.5 });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D1', newDelegatedStake: new BN(1000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D2', newDelegatedStake: new BN(2000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D3', newDelegatedStake: new BN(3000) });
  h.lastProcessedBlock = 20;
  return h;
};

const getHistoryWithIncompleteDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['D2'],
    amounts: [new BN(200)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 1 },
  });
  h.assignmentEvents.push({ block: 5, amount: new BN(600) });
  h.committeeChangeEvents.push({ block: 1, newRelativeWeightInCommittee: 0.5 });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D1', newDelegatedStake: new BN(1000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D2', newDelegatedStake: new BN(2000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D3', newDelegatedStake: new BN(3000) });
  h.lastProcessedBlock = 20;
  return h;
};

describe('isComplete', () => {
  it('works on a complete distribution', () => {
    const d = Distribution.getLast(20, getHistoryWithCompleteDistribution());
    expect(d).not.toBe(null);
    expect(d?.isComplete()).toBe(true);
  });

  it('works on an incomplete distribution', () => {
    const d = Distribution.getLast(20, getHistoryWithIncompleteDistribution());
    expect(d).not.toBe(null);
    expect(d?.isComplete()).toBe(false);
  });
});

describe('startNew', () => {
  it('fails if out of bounds', () => {
    expect(() => {
      Distribution.startNew(11, { fractionForDelegators: 0.6 }, getEmptyBlockHistory(10));
    }).toThrow();
    expect(() => {
      Distribution.startNew(9, { fractionForDelegators: 0.6 }, getEmptyBlockHistory(10));
    }).toThrow();
  });

  it('fails if there already one in progress', () => {
    expect(() => {
      Distribution.startNew(20, { fractionForDelegators: 1 }, getHistoryWithIncompleteDistribution());
    }).toThrow();
  });

  it('returns first distribution with zero as first block', () => {
    const d = Distribution.startNew(10, { fractionForDelegators: 0.6 }, getEmptyBlockHistory(10));
    expect(d.firstBlock).toEqual(0);
    expect(d.lastBlock).toEqual(10);
    expect(d.split).toEqual({ fractionForDelegators: 0.6 });
  });

  it('returns new distribution immediately after the last one', () => {
    const d = Distribution.startNew(20, { fractionForDelegators: 0.6 }, getHistoryWithCompleteDistribution());
    expect(d.firstBlock).toEqual(6);
    expect(d.lastBlock).toEqual(20);
    expect(d.split).toEqual({ fractionForDelegators: 0.6 });
  });
});

const getHistoryWithUnstartedDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.assignmentEvents.push({ block: 5, amount: new BN(600) });
  h.committeeChangeEvents.push({ block: 1, newRelativeWeightInCommittee: 0.5 });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D1', newDelegatedStake: new BN(1000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D2', newDelegatedStake: new BN(2000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D3', newDelegatedStake: new BN(3000) });
  h.lastProcessedBlock = 20;
  return h;
};

describe('sendNextTransaction', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sends to the first recipients if none received', async () => {
    const d = Distribution.startNew(20, { fractionForDelegators: 1 }, getHistoryWithUnstartedDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(async () => {
      return Promise.resolve(getMockReceipt());
    });
    expect(await d.sendNextTransaction(10)).toHaveProperty('isComplete', true);
    expect(d._web3SendTransaction).toHaveBeenCalledWith(
      ['D1', 'D2', 'D3', 'G1'],
      [new BN(100), new BN(200), new BN(300), new BN(0)],
      0,
      undefined
    );
  });

  it('sends only to the remaining recipients if some already received', async () => {
    const d = Distribution.getLast(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(async () => {
      return Promise.resolve(getMockReceipt());
    });
    expect(await d.sendNextTransaction(10)).toHaveProperty('isComplete', true);
    expect(d._web3SendTransaction).toHaveBeenCalledWith(
      ['D1', 'D3', 'G1'],
      [new BN(100), new BN(300), new BN(0)],
      1,
      undefined
    );
  });

  it('does not send if no remaining', async () => {
    const d = Distribution.getLast(20, getHistoryWithCompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(async () => {
      return Promise.resolve(getMockReceipt());
    });
    expect(await d.sendNextTransaction(10)).toHaveProperty('isComplete', true);
    expect(d._web3SendTransaction).not.toHaveBeenCalled();
  });

  it('respects limited number of recipients per tx', async () => {
    const d = Distribution.getLast(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(async () => {
      return Promise.resolve(getMockReceipt());
    });
    expect(await d.sendNextTransaction(2)).toHaveProperty('isComplete', false);
    expect(d._web3SendTransaction).toHaveBeenCalledWith(['D1', 'D3'], [new BN(100), new BN(300)], 1, undefined);
  });

  it('reduces number of recipients if process fails due to too many', async () => {
    const d = Distribution.getLast(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementationOnce(() => {
      throw new TooManyRecipientsError();
    });
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(async () => {
      return Promise.resolve(getMockReceipt());
    });
    expect(await d.sendNextTransaction(10)).toHaveProperty('isComplete', false);
    expect(d._web3SendTransaction).toBeCalledTimes(2);
    expect(d._web3SendTransaction).toHaveBeenNthCalledWith(
      1,
      ['D1', 'D3', 'G1'],
      [new BN(100), new BN(300), new BN(0)],
      1,
      undefined
    );
    expect(d._web3SendTransaction).toHaveBeenNthCalledWith(2, ['D1', 'D3'], [new BN(100), new BN(300)], 1, undefined);
  });

  it('keeps reducing number of recipients if process keeps failing and ultimately fails', async () => {
    const d = Distribution.getLast(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(() => {
      throw new TooManyRecipientsError();
    });
    await expect(d.sendNextTransaction(10)).rejects.toBeInstanceOf(Error);
    expect(d._web3SendTransaction).toBeCalledTimes(3);
    expect(d._web3SendTransaction).toHaveBeenNthCalledWith(
      1,
      ['D1', 'D3', 'G1'],
      [new BN(100), new BN(300), new BN(0)],
      1,
      undefined
    );
    expect(d._web3SendTransaction).toHaveBeenNthCalledWith(2, ['D1', 'D3'], [new BN(100), new BN(300)], 1, undefined);
    expect(d._web3SendTransaction).toHaveBeenNthCalledWith(3, ['D1'], [new BN(100)], 1, undefined);
  });

  it('forwards errors', async () => {
    const d = Distribution.getLast(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d, '_web3SendTransaction').mockImplementation(() => {
      throw new Error('network connection error');
    });
    await expect(d.sendNextTransaction(10)).rejects.toEqual(new Error('network connection error'));
    expect(d._web3SendTransaction).toBeCalledTimes(1);
  });
});

const getMockReceipt = () => {
  return {
    status: false,
    transactionHash: '1111',
    transactionIndex: 1,
    blockHash: '2222',
    blockNumber: 4,
    from: '0xaaaa',
    to: '0xbbbb',
    cumulativeGasUsed: 100,
    gasUsed: 100,
    logs: [],
    logsBloom: '0xcccc',
  };
};
