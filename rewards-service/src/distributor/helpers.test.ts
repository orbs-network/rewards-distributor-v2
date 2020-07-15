import { distributionName, distributionStats } from './helpers';
import { Distribution } from 'rewards-v2';
import BN from 'bn.js';

describe('distributionName', () => {
  it('defines name correctly', () => {
    expect(distributionName(null)).toEqual('genesis');
    const distributionMock = ({
      firstBlock: 0,
      lastBlock: 12345,
    } as unknown) as Distribution;
    expect(distributionName(distributionMock)).toEqual('0-12345');
  });
});

describe('distributionStats', () => {
  it('returns stats correctly', () => {
    expect(distributionStats(null, 1400000000, true)).toEqual({
      DistributionName: 'genesis',
      StartTime: 1400000000,
      Complete: true,
      NumNonGuardianRecipients: 0,
      TotalNonGuardianAmount: '',
      TotalGuardianAmount: '',
    });
    const distributionMock = ({
      firstBlock: 0,
      lastBlock: 12345,
      division: {
        amountsWithoutDelegate: {
          '0xA': new BN('1000000000000000000').mul(new BN(10000)),
          '0xB': new BN('1000000000000000000').mul(new BN(20000)),
          '0xC': new BN('1000000000000000000').mul(new BN(30000)),
        },
        amountForDelegate: new BN('1000000000000000000').mul(new BN(40000)),
      },
    } as unknown) as Distribution;
    expect(distributionStats(distributionMock, 1500000022, false)).toEqual({
      DistributionName: '0-12345',
      StartTime: 1500000022,
      Complete: false,
      NumNonGuardianRecipients: 3,
      TotalNonGuardianAmount: '60000000000000000000000',
      TotalGuardianAmount: '40000000000000000000000',
    });
  });
});
