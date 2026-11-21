/**
 * Air data when live data is unavailable: a seasonal estimate for the place, or the PM2.5 the
 * user typed, both shaped by a typical winter day (docs/02 §2). Labelled in the UI (AL06).
 */
import { mean, round } from '../math.js';
import type { AirData, AirSource, HourlyPoint } from '../schema/air.js';
import type { Location } from '../schema/profile.js';
import { hourOf, localHourKey } from '../time.js';
import {
  CITY_WINTER_PM25,
  COUNTRY_WINTER_PM25,
  DEFAULT_WINTER_PM25,
  DIURNAL,
  MONTH_FACTOR,
} from './data/regions.js';

const DIURNAL_MEAN = mean(DIURNAL);
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` of the day after `date`. */
function nextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

/** Two days of hourly points; `scale` turns the relative diurnal factor into µg/m³. */
function series(date: string, scale: number): HourlyPoint[] {
  return [date, nextDate(date)].flatMap((day) =>
    DIURNAL.map((factor, hour) => ({
      time: `${day}T${String(hour).padStart(2, '0')}:00`,
      pm25: round(factor * scale, 1),
      pm10: null,
    })),
  );
}

function wrap(source: AirSource, location: Location, now: Date, hourly: HourlyPoint[]): AirData {
  return { source, fetchedAt: now.toISOString(), timezone: location.timezone, hourly };
}

/** Typical winter mean for the place, scaled by month (hemisphere-aware). */
export function seasonalLevel(location: Location, month: number): number {
  const winter =
    CITY_WINTER_PM25[location.name.toLowerCase()] ??
    COUNTRY_WINTER_PM25[location.countryCode] ??
    DEFAULT_WINTER_PM25;
  const shifted = location.lat < 0 ? (month + 6) % 12 : month;
  return winter * (MONTH_FACTOR[shifted] ?? 1);
}

/** 48 hours of estimated PM2.5 starting at local midnight today. */
export function seasonalAir(location: Location, now: Date): AirData {
  const key = localHourKey(now, location.timezone);
  const level = seasonalLevel(location, Number(key.slice(5, 7)) - 1);
  const hourly = series(key.slice(0, 10), level / DIURNAL_MEAN);
  return wrap('seasonal-fallback', location, now, hourly);
}

/** Relative winter diurnal factor for an hour; the mean for an invalid hour. */
export function diurnalFactor(hour: number): number {
  return DIURNAL[hour] ?? DIURNAL_MEAN;
}

/** 48 hours shaped so that the current hour equals the PM2.5 the user entered. */
export function manualAir(pm25: number, location: Location, now: Date): AirData {
  const key = localHourKey(now, location.timezone);
  const anchor = diurnalFactor(hourOf(key));
  const hourly = series(key.slice(0, 10), pm25 / anchor);
  return wrap('manual', location, now, hourly);
}
