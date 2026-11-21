/** A01 — index scale and band; A06 — cigarette equivalence (docs/03). */
import { round } from '../time.js';
import { BREAKPOINTS, CIGARETTE_UG_M3 } from './data/scales.js';
import type { Band, Level, Scale } from './types.js';

const MAX_INDEX = 500;
const TOP_LEVEL: Level = 5;

/** India uses the CPCB NAQI; every other country the US EPA AQI (L01). */
export function scaleFor(countryCode: string): Scale {
  return countryCode === 'IN' ? 'NAQI' : 'US_AQI';
}

/** Applies each scale's reporting precision: 0.1 µg/m³ (US, truncated) or integers (NAQI). */
function normalise(pm25: number, scale: Scale): number {
  const c = Math.max(0, pm25);
  return scale === 'US_AQI' ? Math.floor(c * 10) / 10 : Math.round(c);
}

/** Level of the first row whose upper bound contains `c`, or null above the table. */
function levelOf(c: number, scale: Scale): Level | null {
  const i = BREAKPOINTS[scale].findIndex((r) => c <= r.cHigh);
  return i === -1 ? null : (i as Level);
}

/** Sub-index 0–500 by linear interpolation inside the breakpoint row; capped at 500. */
export function indexFor(pm25: number, scale: Scale): number {
  const c = normalise(pm25, scale);
  const level = levelOf(c, scale);
  if (level === null) {
    return MAX_INDEX;
  }
  const { cLow, cHigh, iLow, iHigh } = BREAKPOINTS[scale][level];
  return Math.round(iLow + ((c - cLow) * (iHigh - iLow)) / (cHigh - cLow));
}

/** Band (level 0–5 and the scale's own label) for a PM2.5 concentration. */
export function bandFor(pm25: number, scale: Scale): Band {
  const level = levelOf(normalise(pm25, scale), scale) ?? TOP_LEVEL;
  return { level, label: BREAKPOINTS[scale][level].label };
}

/** A06: cigarettes per day equivalent to breathing a concentration for 24 hours. */
export function cigarettesFor(concentration: number): number {
  return round(concentration / CIGARETTE_UG_M3, 1);
}
