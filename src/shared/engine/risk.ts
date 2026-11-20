/** A02 — sensitive groups; A03 — personal tier (docs/03). */
import type { Household } from '../schema/profile.js';
import { TIER_FLOORS } from './data/scales.js';
import type { SensitiveGroup, Tier } from './types.js';

/** Health-based tier 0–5 from PM2.5, independent of the display scale. */
export function tierFor(pm25: number): Tier {
  return TIER_FLOORS.filter((floor) => pm25 >= floor).length as Tier;
}

/** Members whose presence makes the household's advice stricter. */
export function sensitiveGroups(household: Household): SensitiveGroup[] {
  const groups: SensitiveGroup[] = [];
  if (household.under5 > 0) {
    groups.push('under5');
  }
  if (household.over65 > 0) {
    groups.push('over65');
  }
  if (household.pregnant) {
    groups.push('pregnant');
  }
  if (household.respiratory) {
    groups.push('respiratory');
  }
  if (household.heart) {
    groups.push('heart');
  }
  return groups;
}

/** Sensitive households get advice one tier stricter, capped at 5. */
export function householdTier(tier: Tier, sensitive: boolean): Tier {
  return sensitive ? (Math.min(5, tier + 1) as Tier) : tier;
}

export const SENSITIVE_LABELS: Record<SensitiveGroup, string> = {
  under5: 'a child under 5',
  over65: 'an adult over 65',
  pregnant: 'a pregnancy',
  respiratory: 'asthma or COPD',
  heart: 'a heart condition',
};
