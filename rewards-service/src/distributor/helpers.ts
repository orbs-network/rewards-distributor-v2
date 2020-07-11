import { Distribution } from 'rewards-v2';

export const historyAutoscaleOptions = {
  startWindow: 10000,
  maxWindow: 500000,
  minWindow: 50,
  windowGrowFactor: 2,
  windowGrowAfter: 20,
  windowShrinkFactor: 2,
};

export function distributionName(distribution: Distribution | null): string {
  if (!distribution) return 'genesis';
  return `${distribution.firstBlock}-${distribution.lastBlock}`;
}
