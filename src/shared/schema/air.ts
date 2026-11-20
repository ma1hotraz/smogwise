/** Air-quality data as the engine consumes it (docs/02 §4) and the place search contract. */
import * as z from 'zod/mini';

import { Location } from './profile.js';

/** Hours of forecast kept after trimming the upstream response. */
export const MAX_HOURS = 48;

const concentration = z.number().check(z.gte(0), z.lte(2000));

export const HourlyPoint = z.object({
  /** Local wall-clock time, `YYYY-MM-DDTHH:00`. */
  time: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/)),
  pm25: concentration,
  pm10: z.nullable(concentration),
});
export type HourlyPoint = z.infer<typeof HourlyPoint>;

export const AirSource = z.enum(['open-meteo', 'seasonal-fallback', 'manual']);
export type AirSource = z.infer<typeof AirSource>;

export const AirData = z.object({
  source: AirSource,
  fetchedAt: z.iso.datetime({ offset: true }),
  timezone: z.string().check(z.maxLength(64)),
  hourly: z.array(HourlyPoint).check(z.minLength(1), z.maxLength(MAX_HOURS)),
});
export type AirData = z.infer<typeof AirData>;

/** Query for `/api/air`; coordinates are rounded to 0.1° before use (docs/02 AD5). */
export const AirQuery = z.strictObject({
  lat: z.coerce.number().check(z.gte(-90), z.lte(90)),
  lon: z.coerce.number().check(z.gte(-180), z.lte(180)),
});

/** Query for `/api/geocode`. */
export const GeocodeQuery = z.strictObject({
  q: z.string().check(z.trim(), z.regex(/^[\p{L}\p{M} .,'()-]{2,60}$/u)),
});

export const Place = Location;
export type Place = Location;

export const GeocodeResponse = z.object({ results: z.array(Place).check(z.maxLength(5)) });
export type GeocodeResponse = z.infer<typeof GeocodeResponse>;

/** Rounds a coordinate to one decimal place (~11 km), the privacy grid used everywhere. */
export function roundCoord(value: number): number {
  return Math.round(value * 10) / 10;
}
