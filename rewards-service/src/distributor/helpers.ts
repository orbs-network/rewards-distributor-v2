import { Distribution } from 'rewards-v2';
import { DistributionStats } from '../model/state';
import BN from 'bn.js';

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

export function distributionStats(
  distribution: Distribution | null,
  startTime: number,
  complete: boolean
): DistributionStats {
  const res = {
    StartTime: startTime,
    Complete: complete,
    NumNonGuardianRecipients: 0,
    TotalNonGuardianAmount: '',
    TotalGuardianAmount: '',
  };
  if (!distribution || !distribution.division) return res;
  const totalNonGuardian = new BN(0);
  for (const amount of Object.values(distribution.division.amountsWithoutDelegate)) totalNonGuardian.iadd(amount);
  res.NumNonGuardianRecipients = Object.keys(distribution.division.amountsWithoutDelegate).length;
  res.TotalNonGuardianAmount = totalNonGuardian.toString(10);
  res.TotalGuardianAmount = distribution.division.amountForDelegate.toString(10);
  return res;
}
