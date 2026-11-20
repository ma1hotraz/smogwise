/** Shared test fixtures: profiles, air series and a fixed clock. */
import type { AirData, AirSource } from '../../src/shared/schema/air.js';
import type { Lifestyle, Profile } from '../../src/shared/schema/profile.js';
import { SAMPLES } from '../../src/shared/samples.js';

/** 2026-11-20 10:30 in Delhi (UTC+5:30). */
export const NOW = new Date('2026-11-20T05:00:00Z');
const DATE = '2026-11-20';

export function sample(id: string): Profile {
  const found = SAMPLES.find((s) => s.id === id);
  if (!found) {
    throw new Error(`no sample ${id}`);
  }
  return structuredClone(found.profile);
}

/** A neutral profile: one adult, metro commute, nothing indoors, average home. */
export function baseProfile(
  patch: Partial<Lifestyle> = {},
  household: Partial<Profile['household']> = {},
): Profile {
  return {
    version: 1,
    location: { name: 'Delhi', countryCode: 'IN', lat: 28.7, lon: 77.2, timezone: 'Asia/Kolkata' },
    household: {
      adults: 1,
      under5: 0,
      children: 0,
      over65: 0,
      pregnant: false,
      respiratory: false,
      heart: false,
      ...household,
    },
    lifestyle: {
      commute: { mode: 'metro', km: 10, daysPerWeek: 5, departHour: 9 },
      exercise: { kind: 'none', hour: 7, minutes: 0 },
      cooking: 'induction',
      heating: 'none',
      home: { tightness: 'average', roomM2: 15, purifierCadr: 0 },
      sources: {
        smoking: false,
        incense: false,
        mosquitoCoil: false,
        candles: false,
        drySweeping: false,
      },
      burnsWaste: false,
      ...patch,
    },
  };
}

/** Hourly series from `values` starting at local midnight of `date`. */
export function airFrom(
  values: readonly number[],
  options: { date?: string; source?: AirSource; timezone?: string } = {},
): AirData {
  const start = Date.parse(`${options.date ?? DATE}T00:00:00Z`);
  return {
    source: options.source ?? 'open-meteo',
    fetchedAt: NOW.toISOString(),
    timezone: options.timezone ?? 'Asia/Kolkata',
    hourly: values.map((pm25, i) => ({
      time: new Date(start + i * 3_600_000).toISOString().slice(0, 13) + ':00',
      pm25,
      pm10: null,
    })),
  };
}

/** 48 hours at a constant level. */
export const flatAir = (pm25: number, source: AirSource = 'open-meteo'): AirData =>
  airFrom(
    Array.from({ length: 48 }, () => pm25),
    { source },
  );

/** A winter-shaped day: dirty mornings and nights, cleanest at 14:00–16:00. */
export const WINTER_DAY = [
  170, 175, 178, 180, 180, 178, 175, 171, 160, 140, 120, 105, 95, 88, 86, 90, 110, 130, 150, 160,
  165, 168, 170, 170,
];
export const winterAir = (scale = 1): AirData =>
  airFrom([...WINTER_DAY, ...WINTER_DAY].map((v) => Math.round(v * scale)));
