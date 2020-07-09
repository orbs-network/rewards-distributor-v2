import { EventHistory } from './model';
import { Distribution } from './distributor';
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

beforeAll(() => {
  Distribution.granularity = new BN(100);
});

describe('getLastDistribution', () => {
  it('fails if out of bounds', () => {
    expect(() => {
      Distribution.getLastDistribution(11, getEmptyBlockHistory(10));
    }).toThrow();
    expect(() => {
      Distribution.getLastDistribution(9, getEmptyBlockHistory(10));
    }).toThrow();
  });

  it('returns null if no distribution', () => {
    expect(Distribution.getLastDistribution(10, getEmptyBlockHistory(10))).toBe(null);
  });

  it('returns last distribution even when several out of order in one block', () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithSeveralDistributions());
    if (d == null) fail();
    expect(d.firstBlock).toEqual(10);
    expect(d.lastBlock).toEqual(15);
    expect(d.split).toEqual({ fractionForDelegators: 0.6 });
    expect(d.getPreviousTransfers()).toEqual([d.history.distributionEvents[1], d.history.distributionEvents[2]]);
  });
});

const getHistoryWithCompleteDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['G1', 'D1'],
    amounts: [new BN(300), new BN(100)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 1,
    batchSplit: { fractionForDelegators: 0.5 },
  });
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['G1', 'D2', 'D3'],
    amounts: [new BN(300), new BN(200), new BN(300)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.5 },
  });
  h.assignmentEvents.push({ block: 5, amount: new BN(1200) });
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
    recipientAddresses: ['G1', 'D2'],
    amounts: [new BN(200), new BN(200)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.5 },
  });
  h.assignmentEvents.push({ block: 5, amount: new BN(1200) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D1', newDelegatedStake: new BN(1000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D2', newDelegatedStake: new BN(2000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D3', newDelegatedStake: new BN(3000) });
  h.lastProcessedBlock = 20;
  return h;
};

const getHistoryWithCompleteNoDelegatorsDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['G1'],
    amounts: [new BN(600)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.5 },
  });
  h.assignmentEvents.push({ block: 5, amount: new BN(600) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'G1', newDelegatedStake: new BN(1000) });
  h.lastProcessedBlock = 20;
  return h;
};

const getHistoryWithIncompleteNoDelegatorsDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.distributionEvents.push({
    block: 7,
    recipientAddresses: ['G1'],
    amounts: [new BN(200)],
    batchFirstBlock: 1,
    batchLastBlock: 5,
    batchTxIndex: 0,
    batchSplit: { fractionForDelegators: 0.5 },
  });
  h.assignmentEvents.push({ block: 5, amount: new BN(600) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'G1', newDelegatedStake: new BN(1000) });
  h.lastProcessedBlock = 20;
  return h;
};

describe('isDistributionComplete', () => {
  it('works on a complete distribution', () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithCompleteDistribution());
    expect(d).not.toBe(null);
    expect(d?.isDistributionComplete()).toBe(true);
    const d2 = Distribution.getLastDistribution(20, getHistoryWithCompleteNoDelegatorsDistribution());
    expect(d2).not.toBe(null);
    expect(d2?.isDistributionComplete()).toBe(true);
  });

  it('works on an incomplete distribution', () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithIncompleteDistribution());
    expect(d).not.toBe(null);
    expect(d?.isDistributionComplete()).toBe(false);
    const d2 = Distribution.getLastDistribution(20, getHistoryWithIncompleteNoDelegatorsDistribution());
    expect(d2).not.toBe(null);
    expect(d2?.isDistributionComplete()).toBe(false);
  });
});

describe('startNewDistribution', () => {
  it('fails if out of bounds', () => {
    expect(() => {
      Distribution.startNewDistribution(11, { fractionForDelegators: 0.6 }, getEmptyBlockHistory(10));
    }).toThrow();
    expect(() => {
      Distribution.startNewDistribution(9, { fractionForDelegators: 0.6 }, getEmptyBlockHistory(10));
    }).toThrow();
  });

  it('fails if there already one in progress', () => {
    expect(() => {
      Distribution.startNewDistribution(20, { fractionForDelegators: 1 }, getHistoryWithIncompleteDistribution());
    }).toThrow();
  });

  it('returns first distribution with zero as first block', () => {
    const d = Distribution.startNewDistribution(10, { fractionForDelegators: 0.6 }, getEmptyBlockHistory(10));
    expect(d.firstBlock).toEqual(0);
    expect(d.lastBlock).toEqual(10);
    expect(d.split).toEqual({ fractionForDelegators: 0.6 });
  });

  it('returns new distribution immediately after the last one', () => {
    const d = Distribution.startNewDistribution(
      20,
      { fractionForDelegators: 0.6 },
      getHistoryWithCompleteDistribution()
    );
    expect(d.firstBlock).toEqual(6);
    expect(d.lastBlock).toEqual(20);
    expect(d.split).toEqual({ fractionForDelegators: 0.6 });
  });
});

const getHistoryWithUnstartedDistribution = () => {
  const h = new EventHistory('G1', 1);
  h.assignmentEvents.push({ block: 5, amount: new BN(1200) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D1', newDelegatedStake: new BN(1000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D2', newDelegatedStake: new BN(2000) });
  h.delegationChangeEvents.push({ block: 1, delegatorAddress: 'D3', newDelegatedStake: new BN(3000) });
  h.lastProcessedBlock = 20;
  return h;
};

describe('sendTransactionBatch', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sends to all recipients if none received', async () => {
    const d = Distribution.startNewDistribution(
      20,
      { fractionForDelegators: 0.5 },
      getHistoryWithUnstartedDistribution()
    );
    if (d == null) fail();
    expect(d.getPreviousTransfers()).toEqual([]);
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve(['0x123']);
    });
    const batch = d.prepareTransactionBatch(10);
    expect(batch.length).toEqual(1);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).toHaveBeenCalledWith(
      [
        {
          recipientAddresses: ['G1', 'D1', 'D2', 'D3'],
          amounts: [new BN(600), new BN(100), new BN(200), new BN(300)],
          totalAmount: new BN(1200),
          txIndex: 0,
        },
      ],
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('sends only to the remaining recipients if some already received', async () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    expect(d.getPreviousTransfers()).toEqual([d.history.distributionEvents[0]]);
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve(['0x123']);
    });
    const batch = d.prepareTransactionBatch(10);
    expect(batch.length).toEqual(1);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).toHaveBeenCalledWith(
      [
        {
          recipientAddresses: ['G1', 'D1', 'D3'],
          amounts: [new BN(400), new BN(100), new BN(300)],
          totalAmount: new BN(800),
          txIndex: 1,
        },
      ],
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('sends residue transaction to delegate if did not distribute everything', async () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithIncompleteNoDelegatorsDistribution());
    if (d == null) fail();
    expect(d.getPreviousTransfers()).toEqual([d.history.distributionEvents[0]]);
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve(['0x123']);
    });
    const batch = d.prepareTransactionBatch(10);
    expect(batch.length).toEqual(1);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).toHaveBeenCalledWith(
      [
        {
          recipientAddresses: ['G1'],
          amounts: [new BN(400)],
          totalAmount: new BN(400),
          txIndex: 1,
        },
      ],
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('does not send if no remaining', async () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithCompleteDistribution());
    if (d == null) fail();
    expect(d.getPreviousTransfers()).toEqual([d.history.distributionEvents[0], d.history.distributionEvents[1]]);
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    const batch = d.prepareTransactionBatch(10);
    expect(batch.length).toEqual(0);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).not.toHaveBeenCalled();
  });

  it('does not send if no remaining - no delegators', async () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithCompleteNoDelegatorsDistribution());
    if (d == null) fail();
    expect(d.getPreviousTransfers()).toEqual([d.history.distributionEvents[0]]);
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    const batch = d.prepareTransactionBatch(10);
    expect(batch.length).toEqual(0);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).not.toHaveBeenCalled();
  });

  it('respects limited number of recipients per tx', async () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    expect(d.getPreviousTransfers()).toEqual([d.history.distributionEvents[0]]);
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve(['0x123', '0x456']);
    });
    const batch = d.prepareTransactionBatch(1);
    expect(batch.length).toEqual(2);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).toHaveBeenCalledWith(
      [
        {
          recipientAddresses: ['G1', 'D1'],
          amounts: [new BN(100), new BN(100)],
          totalAmount: new BN(200),
          txIndex: 1,
        },
        {
          recipientAddresses: ['G1', 'D3'],
          amounts: [new BN(300), new BN(300)],
          totalAmount: new BN(600),
          txIndex: 2,
        },
      ],
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('forwards errors', async () => {
    const d = Distribution.getLastDistribution(20, getHistoryWithIncompleteDistribution());
    if (d == null) fail();
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(() => {
      throw new Error('network connection error');
    });
    const batch = d.prepareTransactionBatch(10);
    await expect(d.sendTransactionBatch(batch)).rejects.toEqual(new Error('network connection error'));
    expect(d.ethereum.sendRewardsTransactionBatch).toBeCalledTimes(1);
  });

  it('handles ugly numbers in one big tx', async () => {
    const d = Distribution.startNewDistribution(
      20,
      { fractionForDelegators: 0.8 },
      getHistoryWithUnstartedDistribution()
    );
    if (d == null) fail();
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve(['0x123']);
    });
    const batch = d.prepareTransactionBatch(10);
    expect(batch.length).toEqual(1);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).toHaveBeenCalledWith(
      [
        {
          recipientAddresses: ['G1', 'D1', 'D2', 'D3'],
          amounts: [new BN(400), new BN(100), new BN(300), new BN(400)],
          totalAmount: new BN(1200),
          txIndex: 0,
        },
      ],
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('handles ugly numbers in multiple small txs', async () => {
    const d = Distribution.startNewDistribution(
      20,
      { fractionForDelegators: 0.8 },
      getHistoryWithUnstartedDistribution()
    );
    if (d == null) fail();
    jest.spyOn(d.ethereum, 'sendRewardsTransactionBatch').mockImplementation(async () => {
      return Promise.resolve(['0x123', '0x456', '0x789']);
    });
    const batch = d.prepareTransactionBatch(1);
    expect(batch.length).toEqual(3);
    expect(await d.sendTransactionBatch(batch)).toHaveProperty('isComplete', true);
    expect(d.ethereum.sendRewardsTransactionBatch).toHaveBeenCalledWith(
      [
        {
          recipientAddresses: ['G1', 'D1'],
          amounts: [new BN(0), new BN(100)],
          totalAmount: new BN(100),
          txIndex: 0,
        },
        {
          recipientAddresses: ['G1', 'D2'],
          amounts: [new BN(100), new BN(300)],
          totalAmount: new BN(400),
          txIndex: 1,
        },
        {
          recipientAddresses: ['G1', 'D3'],
          amounts: [new BN(300), new BN(400)],
          totalAmount: new BN(700),
          txIndex: 2,
        },
      ],
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });
});
