/** Location helpers for the browser. */
import type { Location } from '../../shared/schema/profile.js';

/** Countries whose air-quality scale or advice differs, keyed by their main IANA zones. */
const ZONE_COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP',
  'Asia/Shanghai': 'CN',
  'Asia/Ulaanbaatar': 'MN',
  'Europe/Sarajevo': 'BA',
};

/** Best-effort country from the device timezone; `ZZ` (unknown) uses the US AQI scale. */
export function countryFromTimezone(timezone: string): string {
  return ZONE_COUNTRY[timezone] ?? 'ZZ';
}

/** "Delhi, National Capital Territory of Delhi, IN". */
export function placeLabel(place: Location): string {
  const known = place.countryCode === 'ZZ' ? [] : [place.countryCode];
  return [place.name, place.admin1, ...known].filter(Boolean).join(', ');
}
