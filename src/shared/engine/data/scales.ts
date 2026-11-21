/**
 * PM2.5 breakpoint tables (docs/03 A01) and personal tier thresholds (A03).
 * US: EPA PM NAAQS reconsideration, Feb 2024 (24-h PM2.5, truncated to 0.1 µg/m³).
 * India: CPCB National Air Quality Index, 2014 (24-h PM2.5, integers).
 */
import type { Scale } from '../types.js';

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  label: string;
}

/** Exactly six rows, one per level, so `rows[level]` is always defined. */
type SixRows = readonly [Breakpoint, Breakpoint, Breakpoint, Breakpoint, Breakpoint, Breakpoint];

export const BREAKPOINTS: Record<Scale, SixRows> = {
  US_AQI: [
    { cLow: 0, cHigh: 9.0, iLow: 0, iHigh: 50, label: 'Good' },
    { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100, label: 'Moderate' },
    {
      cLow: 35.5,
      cHigh: 55.4,
      iLow: 101,
      iHigh: 150,
      label: 'Unhealthy for Sensitive Groups',
    },
    { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200, label: 'Unhealthy' },
    { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300, label: 'Very Unhealthy' },
    { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500, label: 'Hazardous' },
  ],
  NAQI: [
    { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50, label: 'Good' },
    { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100, label: 'Satisfactory' },
    { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200, label: 'Moderate' },
    { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300, label: 'Poor' },
    { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400, label: 'Very Poor' },
    { cLow: 251, cHigh: 380, iLow: 401, iHigh: 500, label: 'Severe' },
  ],
};

/** Lower PM2.5 bound (µg/m³) of tiers 1–5; tier 0 is below 15 (WHO 2021 24-h guideline). */
export const TIER_FLOORS = [15, 35.5, 55.5, 125.5, 225.5] as const;

export const TIER_NAMES = [
  'Clear',
  'Fair',
  'Caution',
  'Unhealthy',
  'Very unhealthy',
  'Emergency',
] as const;

/** Berkeley Earth (Muller & Muller 2015): 22 µg/m³ PM2.5 for 24 h ≈ one cigarette. */
export const CIGARETTE_UG_M3 = 22;

/** GRAP stage floors on the NAQI (CAQM revised schedule, 2024). */
export const GRAP_FLOORS = [
  { stage: 'I', floor: 201 },
  { stage: 'II', floor: 301 },
  { stage: 'III', floor: 401 },
  { stage: 'IV', floor: 451 },
] as const;

/** Central Delhi and the radius treated as Delhi NCR for GRAP (docs/03 L02). */
export const DELHI = { lat: 28.61, lon: 77.21, radiusKm: 60 } as const;
