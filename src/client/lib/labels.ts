/** Plain-language labels for profile values and plan figures. */
import { MODES } from '../../shared/engine/data/factors.js';
import { TIER_NAMES } from '../../shared/engine/data/scales.js';
import type { Cost, PurifierVerdict, Scale, Tier } from '../../shared/engine/types.js';
import {
  COMMUTE_MODES,
  type CommuteMode,
  type CookingFuel,
  type Heating,
  type IndoorSource,
  type Tightness,
} from '../../shared/schema/profile.js';
import { formatHour } from '../../shared/time.js';

export const modeLabel = (mode: CommuteMode): string => MODES[mode].label;

export const MODE_OPTIONS = COMMUTE_MODES.map((mode) => ({ value: mode, label: modeLabel(mode) }));

export const COOKING_LABELS: Record<CookingFuel, string> = {
  lpg: 'LPG or piped gas',
  induction: 'Induction or electric',
  biomass: 'Wood, dung, coal or kerosene',
};

export const HEATING_LABELS: Record<Heating, string> = {
  none: 'No heating',
  electric: 'Electric heater or radiator',
  brazier: 'Coal or charcoal brazier (angithi)',
  wood: 'Wood fire or stove',
  kerosene: 'Kerosene heater',
};

export const TIGHTNESS_LABELS: Record<Tightness, string> = {
  leaky: 'Draughty: gaps around doors and windows',
  average: 'Average',
  sealed: 'Well sealed, newer building',
};

export const SOURCE_LABELS: Record<IndoorSource, string> = {
  smoking: 'Someone smokes indoors',
  incense: 'Incense (agarbatti) most days',
  mosquitoCoil: 'Mosquito coils at night',
  candles: 'Candles',
  drySweeping: 'Dry sweeping with a broom',
};

/** How the household usually exercises. */
export const EXERCISE_OPTIONS = [
  { value: 'none', label: 'None most days' },
  { value: 'outdoor', label: 'Outdoors (walk, run, cycle, yoga in the park)' },
  { value: 'indoor', label: 'Indoors (home, gym)' },
] as const;

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: formatHour(h),
}));

export const scaleName = (scale: Scale): string => (scale === 'NAQI' ? 'India AQI' : 'US AQI');

export const tierName = (tier: Tier): string => TIER_NAMES[tier];

/** Integers with Indian digit grouping ("1,23,456"), matching the app's primary audience. */
export const formatInt = (value: number): string => Math.round(value).toLocaleString('en-IN');

/** Signed figure for a saving: "3.3 kg less" / "22 kg more". */
export function savingText(value: number, unit: string): string {
  if (value === 0) {
    return `no change in ${unit}`;
  }
  return value > 0 ? `${value} ${unit} less` : `${-value} ${unit} more`;
}

export const COST_LABELS: Record<Cost, string> = {
  free: 'Free',
  low: 'Low cost',
  medium: 'Costs more',
  none: '',
};

/** A fraction as a whole percentage. */
export const percent = (fraction: number): number => Math.round(fraction * 100);

const PURIFIER_TEXT: Record<PurifierVerdict['status'], (coverage: number) => string> = {
  none: () => 'You have no purifier yet; see the first fixes below.',
  undersized: (c) => `Yours covers ${percent(c)}% of that — too small to keep up.`,
  adequate: (c) => `Yours covers ${percent(c)}%: it helps, especially with the door shut.`,
  good: () => 'Yours is big enough. Run it with doors and windows shut.',
};

/** The purifier verdict as a sentence: the CADR this room needs and how the user's unit compares. */
export function purifierText(verdict: PurifierVerdict): string {
  const need = `This room needs a clean-air delivery rate (CADR) of about ${verdict.requiredCadr} m³/h.`;
  return `${need} ${PURIFIER_TEXT[verdict.status](verdict.coverage)}`;
}

/** A swap's effect on the user's own dose, in words. */
export function doseText(delta: number): string {
  if (delta === 0) {
    return 'same dose for you';
  }
  return delta < 0 ? `${-delta}% less for you to breathe` : `${delta}% more for you to breathe`;
}

/** The dose meter's label for a percentage reduction (negative = more). */
export function doseChangeText(reductionPct: number): string {
  if (reductionPct === 0) {
    return 'No change yet';
  }
  return reductionPct > 0
    ? `${reductionPct}% less PM2.5 breathed in`
    : `${-reductionPct}% more PM2.5 breathed in`;
}
