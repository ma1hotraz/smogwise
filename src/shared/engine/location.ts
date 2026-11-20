/** L02 — GRAP stage for Delhi NCR; L03 — where to report burning (docs/03). */
import { DELHI, GRAP_FLOORS } from './data/scales.js';
import { REPORTING, REPORTING_DEFAULT } from './data/regions.js';
import type { GrapStage } from './types.js';

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Indicative GRAP stage when the location is within Delhi NCR and the NAQI is 201+. */
export function grapStage(
  countryCode: string,
  lat: number,
  lon: number,
  naqi: number,
): GrapStage | null {
  if (countryCode !== 'IN' || distanceKm(lat, lon, DELHI.lat, DELHI.lon) > DELHI.radiusKm) {
    return null;
  }
  const reached = GRAP_FLOORS.filter((g) => naqi >= g.floor);
  return reached[reached.length - 1]?.stage ?? null;
}

/** Official channel for reporting open burning in this country. */
export function reportingChannel(countryCode: string): string {
  return REPORTING[countryCode] ?? REPORTING_DEFAULT;
}
