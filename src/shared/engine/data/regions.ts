/**
 * Location-specific data (docs/03 L03) and the seasonal fallback used when live data is
 * unavailable. Winter means are rounded from IQAir World Air Quality Report 2024 city data and
 * labelled in the UI as an estimate.
 */

/** Where to report open burning, by ISO country code. */
export const REPORTING: Record<string, string> = {
  IN: 'Report burning on the CPCB Sameer app or to your state pollution control board (in Delhi, the Green Delhi app).',
  PK: 'Report burning to the provincial Environment Protection Agency (in Lahore, the Punjab EPA helpline).',
  CN: 'Report burning to the 12369 environmental hotline.',
};
export const REPORTING_DEFAULT =
  "Report open burning to your city's municipal or environmental helpline.";

/** Typical winter daily-mean PM2.5 (µg/m³) by city name and by country. */
export const CITY_WINTER_PM25: Record<string, number> = {
  delhi: 180,
  'new delhi': 180,
  gurugram: 170,
  noida: 175,
  lahore: 170,
  dhaka: 160,
  kolkata: 110,
  mumbai: 70,
  kathmandu: 90,
  beijing: 60,
  ulaanbaatar: 120,
  sarajevo: 70,
};
export const COUNTRY_WINTER_PM25: Record<string, number> = {
  IN: 120,
  PK: 150,
  BD: 150,
  NP: 90,
  CN: 60,
  MN: 120,
  BA: 70,
};
export const DEFAULT_WINTER_PM25 = 35;

/** Month multiplier on the winter mean (index 0 = January, northern hemisphere). */
export const MONTH_FACTOR = [1, 0.9, 0.7, 0.5, 0.45, 0.45, 0.45, 0.45, 0.5, 0.7, 0.95, 1] as const;

/**
 * Winter diurnal shape (hour 0–23, relative): inversions trap pollution overnight and in the
 * morning; afternoon mixing is cleanest. Normalised to a mean of 1 in code.
 */
export const DIURNAL = [
  1.25, 1.3, 1.32, 1.33, 1.33, 1.32, 1.3, 1.25, 1.12, 0.98, 0.85, 0.74, 0.66, 0.62, 0.62, 0.66,
  0.76, 0.9, 1.05, 1.15, 1.2, 1.22, 1.24, 1.25,
] as const;
