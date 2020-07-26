import { HistoryDownloader } from './history-downloader';

describe('HistoryDownloader', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('fails if no more blocks to download', async () => {
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    d.history.lastProcessedBlock = 10;
    await expect(d.processNextBatch(100, 10)).rejects.toBeInstanceOf(Error);
    expect(d.ethereum.readEvents).not.toBeCalled();
  });

  it('downloads correct block range when page size is large', async () => {
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    d.history.lastProcessedBlock = 10;
    expect(await d.processNextBatch(100, 20)).toEqual(20);
    expect(d.ethereum.readEvents).toHaveBeenCalledWith(expect.anything(), expect.anything(), 11, 20, expect.anything());
  });

  it('downloads correct block range when page size is small', async () => {
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    d.history.lastProcessedBlock = 10;
    expect(await d.processNextBatch(5, 20)).toEqual(15);
    expect(d.ethereum.readEvents).toHaveBeenCalledWith(expect.anything(), expect.anything(), 11, 15, expect.anything());
  });

  it('forwards errors', async () => {
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(() => {
      throw new Error('network connection error');
    });
    d.history.lastProcessedBlock = 10;
    await expect(d.processNextBatch(100, 20)).rejects.toEqual(new Error('network connection error'));
  });

  it('passes filter only when not storeExtraHistoryPerDelegate', async () => {
    // d is HistoryDownloader with storeExtraHistoryPerDelegate = false (default)
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    d.history.lastProcessedBlock = 10;
    expect(await d.processNextBatch(100, 20)).toEqual(20);
    expect(d.ethereum.readEvents).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), 11, 20, {
      addr: '0xg1',
    });
    expect(d.ethereum.readEvents).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), 11, 20, undefined);
    expect(d.ethereum.readEvents).toHaveBeenNthCalledWith(3, expect.anything(), expect.anything(), 11, 20, {
      distributer: '0xg1',
    });

    // d2 is HistoryDownloader with storeExtraHistoryPerDelegate = true
    const d2 = new HistoryDownloader('G1', 0, true);
    jest.spyOn(d2.ethereum, 'readEvents').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    d2.history.lastProcessedBlock = 10;
    expect(await d2.processNextBatch(100, 20)).toEqual(20);
    expect(d2.ethereum.readEvents).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), 11, 20, undefined);
    expect(d2.ethereum.readEvents).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), 11, 20, undefined);
    expect(d2.ethereum.readEvents).toHaveBeenNthCalledWith(3, expect.anything(), expect.anything(), 11, 20, undefined);
  });
});
