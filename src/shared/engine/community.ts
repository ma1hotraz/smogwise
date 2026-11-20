/** C01–C03 — community actions and scaled impact (docs/03). */
import type { Household, Lifestyle } from '../schema/profile.js';
import { round } from '../time.js';
import { COMMUNITY_COPY, fill } from './data/copy.js';
import { CAR_MODES, TREE_KG_CO2_YEAR, WEEKS_PER_MONTH } from './data/factors.js';
import { reportingChannel } from './location.js';
import type { CommunityAction, Swap, Tier } from './types.js';

export interface CommunityContext {
  lifestyle: Lifestyle;
  household: Household;
  tierGeneral: Tier;
  countryCode: string;
}

type ActionId = keyof typeof COMMUNITY_COPY;

/** When each community action applies (C03). Order is the display order. */
const WHEN: Record<ActionId, (ctx: CommunityContext) => boolean> = {
  carpool: (c) => CAR_MODES.includes(c.lifestyle.commute.mode),
  compost: () => true,
  report: () => true,
  'clean-room': (c) => c.tierGeneral >= 3,
  school: (c) => c.household.under5 + c.household.children > 0,
  neighbours: (c) => c.tierGeneral >= 4,
};

/** C03: actions a housing society, school or workplace can take together. */
export function communityActions(ctx: CommunityContext): CommunityAction[] {
  const channel = reportingChannel(ctx.countryCode);
  return (Object.keys(WHEN) as ActionId[])
    .filter((id) => WHEN[id](ctx))
    .map((id) => ({
      id,
      ruleId: 'C03',
      title: COMMUNITY_COPY[id].title,
      detail: fill(COMMUNITY_COPY[id].detail, { channel }),
    }));
}

export interface CommunityImpact {
  co2KgMonth: number;
  pm25GMonth: number;
  /** Trees needed to take up that much CO₂ in a year (C02, approximate). */
  treeYears: number;
}

/** C01: monthly savings if `households` homes adopt the selected swaps. */
export function scaleImpact(swaps: readonly Swap[], households: number): CommunityImpact {
  const factor = households * WEEKS_PER_MONTH;
  const co2 = swaps.reduce((sum, s) => sum + Math.max(0, s.co2KgWeek ?? 0), 0) * factor;
  const pm25 = swaps.reduce((sum, s) => sum + Math.max(0, s.pm25GWeek), 0) * factor;
  return {
    co2KgMonth: Math.round(co2),
    pm25GMonth: Math.round(pm25),
    treeYears: Math.round((co2 * 12) / TREE_KG_CO2_YEAR),
  };
}

/** Grams to a readable mass ("820 g", "3.4 kg"). */
export function formatGrams(grams: number): string {
  return grams >= 1000 ? `${round(grams / 1000, 1)} kg` : `${Math.round(grams)} g`;
}
