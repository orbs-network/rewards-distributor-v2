import mockFs from 'mock-fs';
import { writeStatusToDisk } from './status';
import { State } from '..';
import { readFileSync } from 'fs';
import { exampleConfig } from '../config.example';

describe('status', () => {
  beforeAll(() => {
    console.log('Use console.log before mock-fs to workaround https://github.com/facebook/jest/issues/5792');
  });
  afterEach(() => {
    mockFs.restore();
  });

  it('updates and writes Timestamp', () => {
    const state = new State();
    mockFs({ ['./status/status.json']: '' });
    writeStatusToDisk('./status/status.json', state, exampleConfig);

    const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
    console.log('result:', JSON.stringify(writtenContents, null, 2));

    expect(new Date().getTime() - new Date(writtenContents.Timestamp).getTime()).toBeLessThan(1000);
  });
});
