import mockFs from 'mock-fs';
import { parseArgs } from './cli-args';
import _ from 'lodash';
import { exampleConfig } from './config.example';

describe('parseArgs', () => {
  beforeAll(() => {
    console.log('Use console.log before mock-fs to workaround https://github.com/facebook/jest/issues/5792');
    console.error = jest.fn(); // to avoid annoying prints in tests
  });
  afterEach(() => {
    mockFs.restore();
  });

  it('fails when default config file does not exist', () => {
    expect(() => parseArgs([])).toThrow();
  });

  it('works when default config file is valid', () => {
    mockFs({
      ['./config.json']: JSON.stringify(exampleConfig),
    });
    expect(parseArgs([])).toEqual(exampleConfig);
  });

  it('fails when custom config file does not exist', () => {
    expect(() => parseArgs(['--config', './some/file.json'])).toThrow();
  });

  it('works when custom config file is valid', () => {
    mockFs({
      ['./some/file.json']: JSON.stringify(exampleConfig),
    });
    expect(parseArgs(['--config', './some/file.json'])).toEqual(exampleConfig);
  });

  it('merges two valid custom config files', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mergedConfig: any = _.cloneDeep(exampleConfig);
    mergedConfig.SomeField = 'some value';
    mockFs({
      ['./first/file1.json']: JSON.stringify({ SomeField: 'some value' }),
      ['./second/file2.json']: JSON.stringify(exampleConfig),
    });
    expect(parseArgs(['--config', './first/file1.json', './second/file2.json'])).toEqual(mergedConfig);
  });

  it('fails when custom config file has invalid JSON format', () => {
    mockFs({
      ['./some/file.json']: JSON.stringify(exampleConfig) + '}}}',
    });
    expect(() => parseArgs(['--config', './some/file.json'])).toThrow();
  });

  it('fails when custom config file is missing SignerEndpoint', () => {
    const partialConfig = _.cloneDeep(exampleConfig);
    delete partialConfig.SignerEndpoint;
    mockFs({
      ['./some/partial.json']: JSON.stringify(partialConfig),
    });
    expect(() => parseArgs(['--config', './some/partial.json'])).toThrow();
  });
});
