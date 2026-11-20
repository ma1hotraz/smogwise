/**
 * Open-Meteo geocoding and air-quality clients (docs/05 §1 "Upstream fetch"). Hosts are fixed,
 * parameters go through URLSearchParams, responses are time- and size-capped and validated
 * before anything reaches the engine.
 */
import * as z from 'zod/mini';

import { MAX_HOURS, type AirData, type HourlyPoint, type Place } from '../../shared/schema/air.js';
import { Location } from '../../shared/schema/profile.js';

export type FetchFn = (input: URL, init: RequestInit) => Promise<Response>;

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const MAX_BYTES = 512 * 1024;
const MAX_RESULTS = 5;
const MAX_CONCENTRATION = 2000;

/** Any upstream failure; routes map it to a generic 502. */
export class UpstreamError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'UpstreamError';
  }
}

const GeocodeBody = z.object({
  results: z.optional(
    z.array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country_code: z.optional(z.string()),
        timezone: z.optional(z.string()),
        admin1: z.optional(z.string()),
      }),
    ),
  ),
});

const series = z.array(z.nullable(z.number()));
const AirBody = z.object({
  timezone: z.string(),
  hourly: z.object({ time: z.array(z.string()), pm2_5: series, pm10: series }),
});

async function getJson(fetchFn: FetchFn, url: URL, timeoutMs: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new UpstreamError('unreachable');
  }
  if (!response.ok) {
    throw new UpstreamError(`status_${response.status}`);
  }
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) {
    throw new UpstreamError('too_large');
  }
  const text = await response.text();
  if (text.length > MAX_BYTES) {
    throw new UpstreamError('too_large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new UpstreamError('invalid_json');
  }
}

function toPlace(raw: NonNullable<z.infer<typeof GeocodeBody>['results']>[number]): Place | null {
  const parsed = Location.safeParse({
    name: raw.name,
    admin1: raw.admin1,
    countryCode: raw.country_code,
    lat: Math.round(raw.latitude * 100) / 100,
    lon: Math.round(raw.longitude * 100) / 100,
    timezone: raw.timezone,
  });
  return parsed.success ? parsed.data : null;
}

const clampPm = (value: number): number =>
  Math.round(Math.min(MAX_CONCENTRATION, Math.max(0, value)) * 10) / 10;

function toHourly(body: z.infer<typeof AirBody>): HourlyPoint[] {
  const { time, pm2_5, pm10 } = body.hourly;
  const points: HourlyPoint[] = [];
  time.forEach((stamp, i) => {
    const pm25 = pm2_5[i];
    if (typeof pm25 === 'number' && /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(stamp)) {
      const coarse = pm10[i];
      points.push({
        time: stamp,
        pm25: clampPm(pm25),
        pm10: typeof coarse === 'number' ? clampPm(coarse) : null,
      });
    }
  });
  return points.slice(0, MAX_HOURS);
}

/** Builds a fixed-host URL; values are encoded by URLSearchParams, never concatenated. */
function urlFor(base: string, params: Record<string, string>): URL {
  const url = new URL(base);
  url.search = new URLSearchParams(params).toString();
  return url;
}

async function geocode(fetchFn: FetchFn, timeoutMs: number, query: string): Promise<Place[]> {
  const url = urlFor(GEOCODE_URL, { name: query, count: '10', language: 'en', format: 'json' });
  const body = GeocodeBody.safeParse(await getJson(fetchFn, url, timeoutMs));
  if (!body.success) {
    throw new UpstreamError('schema');
  }
  return (body.data.results ?? [])
    .map(toPlace)
    .filter((p): p is Place => p !== null)
    .slice(0, MAX_RESULTS);
}

async function airQuality(
  fetchFn: FetchFn,
  timeoutMs: number,
  lat: number,
  lon: number,
  fetchedAt: Date,
): Promise<AirData> {
  const url = urlFor(AIR_URL, {
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'pm2_5,pm10',
    timezone: 'auto',
    forecast_days: '2',
  });
  const body = AirBody.safeParse(await getJson(fetchFn, url, timeoutMs));
  if (!body.success) {
    throw new UpstreamError('schema');
  }
  const hourly = toHourly(body.data);
  if (hourly.length === 0) {
    throw new UpstreamError('empty');
  }
  const timezone = body.data.timezone.slice(0, 64);
  return { source: 'open-meteo', fetchedAt: fetchedAt.toISOString(), timezone, hourly };
}

export interface OpenMeteo {
  geocode(query: string): Promise<Place[]>;
  air(lat: number, lon: number, fetchedAt: Date): Promise<AirData>;
}

/** Creates the client with an injected `fetch` (tests pass a fake; no network in tests). */
export function createOpenMeteo(fetchFn: FetchFn, timeoutMs: number): OpenMeteo {
  return {
    geocode: (query) => geocode(fetchFn, timeoutMs, query),
    air: (lat, lon, fetchedAt) => airQuality(fetchFn, timeoutMs, lat, lon, fetchedAt),
  };
}
