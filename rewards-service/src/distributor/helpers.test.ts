import { distributionName } from './helpers';
import { Distribution } from 'rewards-v2';

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
