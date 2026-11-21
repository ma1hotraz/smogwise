/** I — indoor mass-balance model and purifier sizing (docs/03). */
import { INDOOR_SOURCES, type Lifestyle } from '../schema/profile.js';
import { round } from '../time.js';
import {
  AIR_EXCHANGE,
  COOKING_DELTA,
  HEATING_DELTA,
  INDOOR,
  SOURCE_DELTA,
} from './data/factors.js';
import type { Choices, PurifierVerdict } from './types.js';

/** Physical state of the main room that the model needs. */
export interface HomeState {
  /** Air exchange rate with windows closed, h⁻¹. */
  ach: number;
  volume: number;
  /** Rated clean-air delivery rate, m³/h (0 = none). */
  cadr: number;
  /** Sum of indoor source strengths, expressed as Δref µg/m³. */
  sourceDelta: number;
}

/** Emission rate (µg/h) per 1 µg/m³ of Δref: the reference room's removal capacity. */
const EMISSION_PER_DELTA = INDOOR.referenceVolume * (INDOOR.referenceAch + INDOOR.deposition);

function sourceDelta(lifestyle: Lifestyle, choices: Choices): number {
  const removed = new Set(choices.removeSources ?? []);
  const sources = INDOOR_SOURCES.filter((s) => lifestyle.sources[s] && !removed.has(s)).reduce(
    (sum, s) => sum + SOURCE_DELTA[s],
    0,
  );
  const cooking = choices.cooking ?? lifestyle.cooking;
  const cookingKey = cooking === 'lpg' && choices.kitchenExhaust === true ? 'lpgExhaust' : cooking;
  return sources + COOKING_DELTA[cookingKey] + HEATING_DELTA[choices.heating ?? lifestyle.heating];
}

/** Derives the room state from the profile, with any what-if choices applied. */
export function homeState(lifestyle: Lifestyle, choices: Choices = {}): HomeState {
  const { home } = lifestyle;
  const base = AIR_EXCHANGE[home.tightness];
  const sealed = choices.sealGaps === true && home.tightness !== 'sealed';
  return {
    ach: sealed ? Math.max(INDOOR.minAch, base * INDOOR.sealFactor) : base,
    volume: home.roomM2 * INDOOR.ceilingM,
    cadr: choices.purifierCadr ?? home.purifierCadr,
    sourceDelta: sourceDelta(lifestyle, choices),
  };
}

function removalRate(state: HomeState): number {
  return state.ach + INDOOR.deposition + (state.cadr * INDOOR.purifierDerate) / state.volume;
}

/** Indoor/outdoor ratio from infiltration alone. */
export function indoorRatio(state: HomeState): number {
  return (INDOOR.penetration * state.ach) / removalRate(state);
}

/** Steady-state indoor PM2.5: `(P·a·C_out + E/V) / (a + k + CADR_eff/V)`. */
export function indoorPm(outdoor: number, state: HomeState): number {
  const infiltration = INDOOR.penetration * state.ach * outdoor;
  const sources = (state.sourceDelta * EMISSION_PER_DELTA) / state.volume;
  return (infiltration + sources) / removalRate(state);
}

/** Purifier verdict against 5 air changes per hour (≈ AHAM "2/3 rule"). */
export function purifierVerdict(roomM2: number, cadr: number): PurifierVerdict {
  const requiredCadr = Math.round(roomM2 * INDOOR.ceilingM * INDOOR.targetAch);
  const coverage = round(cadr / requiredCadr, 2);
  if (cadr === 0) {
    return { status: 'none', requiredCadr, coverage: 0 };
  }
  if (coverage < 0.6) {
    return { status: 'undersized', requiredCadr, coverage };
  }
  return { status: coverage < 1 ? 'adequate' : 'good', requiredCadr, coverage };
}
