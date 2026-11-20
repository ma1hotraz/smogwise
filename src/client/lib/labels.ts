/** Plain-language labels for profile values and plan figures. */
import { MODES } from '../../shared/engine/data/factors.js';
import { TIER_NAMES } from '../../shared/engine/data/scales.js';
import type { Scale, Tier } from '../../shared/engine/types.js';
import {
  COMMUTE_MODES,
  type CommuteMode,
  type CookingFuel,
  type Heating,
  type IndoorSource,
  type Tightness,
} from '../../shared/schema/profile.js';
import { formatHour } from '../../shared/time.js';

export const MODE_OPTIONS = COMMUTE_MODES.map((mode) => ({
  value: mode,
  label: MODES[mode].label,
}));

export const modeLabel = (mode: CommuteMode): string => MODES[mode].label;

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

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: formatHour(h),
}));

export const scaleName = (scale: Scale): string => (scale === 'NAQI' ? 'India AQI' : 'US AQI');

export const tierName = (tier: Tier): string => TIER_NAMES[tier];

/** "1,234" style integers for the user's locale. */
export const formatInt = (value: number): string => Math.round(value).toLocaleString('en-IN');

/** Signed figure for a saving: "3.3 kg less" / "22 kg more". */
export function savingText(value: number, unit: string): string {
  if (value === 0) {
    return `no change in ${unit}`;
  }
  return value > 0 ? `${value} ${unit} less` : `${-value} ${unit} more`;
}
