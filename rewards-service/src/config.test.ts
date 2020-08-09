import _ from 'lodash';
import { validateConfiguration, Configuration } from './config';
import { exampleConfig } from './config.example';

describe('validateConfiguration', () => {
  it(' works on valid config', () => {
    expect(() => validateConfiguration(exampleConfig)).not.toThrow();
  });

  for (const configKeyName in exampleConfig) {
    it(`fails on missing ${configKeyName}`, () => {
      const partialConfig = _.cloneDeep(exampleConfig);
      delete partialConfig[configKeyName as keyof Configuration];
      expect(() => validateConfiguration(partialConfig)).toThrow();
    });
  }

  it('fails on invalid EthereumElectionsContract', () => {
    const invalidConfig = _.cloneDeep(exampleConfig);
    invalidConfig.EthereumGenesisContract = 'hello world';
    expect(() => validateConfiguration(invalidConfig)).toThrow();
  });

  it('fails on invalid NodeOrbsAddress', () => {
    const invalidConfig = _.cloneDeep(exampleConfig);
    invalidConfig.GuardianAddress = 'hello world';
    expect(() => validateConfiguration(invalidConfig)).toThrow();
    invalidConfig.GuardianAddress = '11f4d0a3c12e86b4b5f39b213f7e19d048276dae'; // should start with "0x"
    expect(() => validateConfiguration(invalidConfig)).toThrow();
  });

  it('fails when string given instead of number', () => {
    const invalidConfig = JSON.parse(JSON.stringify(exampleConfig));
    invalidConfig.StatusPollTimeSeconds = '99'; // as string
    expect(() => validateConfiguration(invalidConfig)).toThrow();
  });
});
