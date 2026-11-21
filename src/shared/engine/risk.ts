/** A02 — sensitive groups; A03 — personal tier (docs/03). */
import type { Household } from '../schema/profile.js';
import { TIER, TIER_FLOORS } from './data/scales.js';
import type { SensitiveGroup, Tier } from './types.js';

/**
 * The only conversion from a number to a Tier: clamps to TIER.clear–TIER.emergency. (TypeScript
 * cannot narrow arithmetic to a literal union, hence the single assertion.)
 */
function toTier(n: number): Tier {
  return Math.min(TIER.emergency, Math.max(TIER.clear, Math.round(n))) as Tier;
}

/** Health-based tier 0–5 from PM2.5, independent of the display scale. */
export function tierFor(pm25: number): Tier {
  return toTier(TIER_FLOORS.filter((floor) => pm25 >= floor).length);
}

/** Which household members make advice stricter. Order is the display order. */
const SENSITIVE_WHEN: Record<SensitiveGroup, (h: Household) => boolean> = {
  under5: (h) => h.under5 > 0,
  over65: (h) => h.over65 > 0,
  pregnant: (h) => h.pregnant,
  respiratory: (h) => h.respiratory,
  heart: (h) => h.heart,
};

const SENSITIVE_GROUPS: readonly SensitiveGroup[] = [
  'under5',
  'over65',
  'pregnant',
  'respiratory',
  'heart',
];

/** Members whose presence makes the household's advice stricter. */
export function sensitiveGroups(household: Household): SensitiveGroup[] {
  return SENSITIVE_GROUPS.filter((group) => SENSITIVE_WHEN[group](household));
}

/** Sensitive households get advice one tier stricter, capped at the top tier. */
export function householdTier(tier: Tier, sensitive: boolean): Tier {
  return sensitive ? toTier(tier + 1) : tier;
}
