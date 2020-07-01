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
    expect(d.ethereum.readEvents).toHaveBeenCalledWith(expect.anything(), expect.anything(), 11, 20);
  });

  it('downloads correct block range when page size is small', async () => {
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(async () => {
      return Promise.resolve([]);
    });
    d.history.lastProcessedBlock = 10;
    expect(await d.processNextBatch(5, 20)).toEqual(15);
    expect(d.ethereum.readEvents).toHaveBeenCalledWith(expect.anything(), expect.anything(), 11, 15);
  });

  it('forwards errors', async () => {
    const d = new HistoryDownloader('G1', 0);
    jest.spyOn(d.ethereum, 'readEvents').mockImplementation(() => {
      throw new Error('network connection error');
    });
    d.history.lastProcessedBlock = 10;
    await expect(d.processNextBatch(100, 20)).rejects.toEqual(new Error('network connection error'));
  });
});
