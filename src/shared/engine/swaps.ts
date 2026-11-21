/** S01–S09 — sustainable alternatives with CO₂, PM2.5 and personal-dose impact (docs/03). */
import type { CommuteMode, Lifestyle } from '../schema/profile.js';
import { round } from '../time.js';
import {
  burnsFuelIndoors,
  CAR_MODES,
  COOKING_WEEK,
  HEATING_WEEK,
  MODES,
  WASTE_BURNING_PM25_G_WEEK,
} from './data/factors.js';
import { commutes } from './choices.js';
import { doseFor, percentChange } from './exposure.js';
import { homeState } from './indoor.js';
import type { Choices, RuleId, Swap } from './types.js';

interface SwapContext {
  lifestyle: Lifestyle;
  ambient: readonly number[];
  countryCode: string;
}

const ALTERNATIVES: {
  mode: CommuteMode;
  ruleId: RuleId;
  title: string;
  skip: readonly CommuteMode[];
  maxKm: number;
}[] = [
  { mode: 'walk', ruleId: 'S01', title: 'Walk this trip', skip: ['walk', 'cycle'], maxKm: 2 },
  { mode: 'cycle', ruleId: 'S02', title: 'Cycle instead', skip: ['walk', 'cycle'], maxKm: 8 },
  {
    mode: 'metro',
    ruleId: 'S03',
    title: 'Take the metro',
    skip: ['metro', 'walk', 'cycle'],
    maxKm: Infinity,
  },
  {
    mode: 'bus',
    ruleId: 'S03',
    title: 'Take the bus',
    skip: ['bus', 'metro', 'walk', 'cycle'],
    maxKm: Infinity,
  },
  {
    mode: 'ev',
    ruleId: 'S05',
    title: 'Switch to an EV (long-term)',
    skip: ['walk', 'cycle', 'two_wheeler', 'auto', 'bus', 'metro', 'ev'],
    maxKm: Infinity,
  },
];

/** Dose on a commute day with lifestyle and home changes applied. */
function dayDose(
  ctx: SwapContext,
  lifestyle: Lifestyle,
  choices: Choices,
  commuting = true,
): number {
  return doseFor({
    ambient: ctx.ambient,
    lifestyle,
    home: homeState(lifestyle, choices),
    n95: false,
    commuting,
  }).totalUg;
}

const tradeOffFor = (delta: number): string | null =>
  delta > 0
    ? `Your own dose rises about ${delta}% on smog days (traffic air and deeper breathing). Best on clearer days, or with an N95.`
    : null;

function commuteSwaps(ctx: SwapContext, base: number): Swap[] {
  const { commute } = ctx.lifestyle;
  const now = MODES[commute.mode];
  const weeklyKm = 2 * commute.km * commute.daysPerWeek;
  const fits = ALTERNATIVES.filter((a) => !a.skip.includes(commute.mode) && commute.km <= a.maxKm);
  return fits.map((alt) => {
    const next = MODES[alt.mode];
    const lifestyle = { ...ctx.lifestyle, commute: { ...commute, mode: alt.mode } };
    const delta = percentChange(base, dayDose(ctx, lifestyle, {}));
    return {
      id: `mode-${alt.mode}`,
      ruleId: alt.ruleId,
      title: alt.title,
      detail: `${weeklyKm} km a week by ${next.label.toLowerCase()} instead of ${now.label.toLowerCase()}${alt.mode === 'metro' || alt.mode === 'bus' ? ', if there is a route near you' : ''}.`,
      co2KgWeek: round((now.co2 - next.co2) * weeklyKm, 1),
      pm25GWeek: round((now.pm25 - next.pm25) * weeklyKm, 1),
      doseDeltaPct: delta,
      tradeOff: tradeOffFor(delta),
      choice: { kind: 'mode', mode: alt.mode },
    };
  });
}

function sharedTripSwaps(ctx: SwapContext, base: number): Swap[] {
  const { commute } = ctx.lifestyle;
  const now = MODES[commute.mode];
  const swaps: Swap[] = [];
  if (CAR_MODES.includes(commute.mode)) {
    const weeklyKm = commute.km * commute.daysPerWeek;
    swaps.push({
      id: 'carpool',
      ruleId: 'S04',
      title: 'Carpool with one colleague',
      detail: 'Two people per car halves those trips for the same journeys.',
      co2KgWeek: round(now.co2 * weeklyKm, 1),
      pm25GWeek: round(now.pm25 * weeklyKm, 1),
      doseDeltaPct: 0,
      tradeOff: null,
      choice: { kind: 'carpool' },
    });
  }
  if (commute.daysPerWeek >= 3) {
    const km = 2 * commute.km * 2;
    swaps.push({
      id: 'wfh',
      ruleId: 'S06',
      title: 'Work from home two days a week',
      detail: 'If your job allows it. The dose figure is the change on a home day.',
      co2KgWeek: round(now.co2 * km, 1),
      pm25GWeek: round(now.pm25 * km, 1),
      doseDeltaPct: percentChange(base, dayDose(ctx, ctx.lifestyle, {}, false)),
      tradeOff: null,
      choice: { kind: 'wfhDays', days: 2 },
    });
  }
  return swaps;
}

function cookingSwap(ctx: SwapContext, base: number): Swap {
  const lifestyle: Lifestyle = { ...ctx.lifestyle, cooking: 'lpg' };
  const scheme =
    ctx.countryCode === 'IN'
      ? ' The PM Ujjwala Yojana scheme can help with an LPG connection.'
      : '';
  return {
    id: 'cooking',
    ruleId: 'S07',
    title: 'Cook on LPG, piped gas or induction',
    detail: `Biomass and kerosene smoke is the largest indoor pollution source there is.${scheme}`,
    co2KgWeek: null,
    pm25GWeek: round(COOKING_WEEK.biomass.pm25 - COOKING_WEEK.lpg.pm25, 1),
    doseDeltaPct: percentChange(base, dayDose(ctx, lifestyle, {})),
    tradeOff: null,
    choice: { kind: 'cooking', fuel: 'lpg' },
  };
}

/** Electric heating can add grid CO₂ even as it removes indoor smoke; say so honestly. */
export function heatingTradeOff(co2Saved: number): string | null {
  return co2Saved < 0
    ? `Uses about ${-co2Saved} kg more grid CO₂ a week, but removes indoor smoke and the carbon-monoxide risk.`
    : null;
}

function heatingSwap(ctx: SwapContext, base: number): Swap {
  const current = HEATING_WEEK[ctx.lifestyle.heating];
  const co2 = round((current.co2 ?? 0) - HEATING_WEEK.electric.co2, 1);
  const lifestyle: Lifestyle = { ...ctx.lifestyle, heating: 'electric' };
  return {
    id: 'heating',
    ruleId: 'S08',
    title: 'Heat with an electric or oil-filled radiator',
    detail: 'Add draught strips and warm layers so a small heater is enough.',
    co2KgWeek: co2,
    pm25GWeek: current.pm25,
    doseDeltaPct: percentChange(base, dayDose(ctx, lifestyle, {})),
    tradeOff: heatingTradeOff(co2),
    choice: { kind: 'heating', heating: 'electric' },
  };
}

const BURNING_SWAP: Swap = {
  id: 'burning',
  ruleId: 'S09',
  title: 'Compost leaves and waste instead of burning',
  detail: `Burning 2 kg a week puts about ${WASTE_BURNING_PM25_G_WEEK} g of PM2.5 into your street's air, right where children walk.`,
  co2KgWeek: null,
  pm25GWeek: WASTE_BURNING_PM25_G_WEEK,
  doseDeltaPct: 0,
  tradeOff: null,
  choice: { kind: 'stopBurning' },
};

/** Every alternative that fits this household, in a stable order. */
export function swapsFor(ctx: SwapContext): Swap[] {
  const { lifestyle } = ctx;
  const base = dayDose(ctx, lifestyle, {});
  return [
    ...(commutes(lifestyle) ? [...commuteSwaps(ctx, base), ...sharedTripSwaps(ctx, base)] : []),
    ...(lifestyle.cooking === 'biomass' ? [cookingSwap(ctx, base)] : []),
    ...(burnsFuelIndoors(lifestyle.heating) ? [heatingSwap(ctx, base)] : []),
    ...(lifestyle.burnsWaste ? [BURNING_SWAP] : []),
  ];
}
