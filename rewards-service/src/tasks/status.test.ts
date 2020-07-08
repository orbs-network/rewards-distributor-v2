import mockFs from 'mock-fs';
import { StatusWriter } from './status';
import { State } from '../model/state';
import { readFileSync } from 'fs';
import { exampleConfig } from '../config.example';

describe('status', () => {
  beforeAll(() => {
    console.log('Use console.log before mock-fs to workaround https://github.com/facebook/jest/issues/5792');
  });
  afterEach(() => {
    mockFs.restore();
  });

  it('updates and writes Timestamp', async () => {
    mockFs({ ['./status/status.json']: '' });

    const state = new State();
    const statusWriter = new StatusWriter(state, exampleConfig);
    await statusWriter.run();

    const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
    console.log('result:', JSON.stringify(writtenContents, null, 2));

    expect(new Date().getTime() - new Date(writtenContents.Timestamp).getTime()).toBeLessThan(1000);
  });
});
