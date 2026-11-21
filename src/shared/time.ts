/** Time helpers shared by engine, server and client. Pure: the instant is always passed in. */

/** Local wall-clock hour key `YYYY-MM-DDTHH:00` for an instant in an IANA timezone (UTC if unknown). */
export function localHourKey(now: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  };
  let text: string;
  try {
    // Swedish formatting is ISO-like: "2026-11-20 10".
    text = new Intl.DateTimeFormat('sv-SE', { ...options, timeZone: timezone }).format(now);
  } catch {
    text = new Intl.DateTimeFormat('sv-SE', { ...options, timeZone: 'UTC' }).format(now);
  }
  return `${text.replace(' ', 'T')}:00`;
}

/** Hour 0–23 of a key produced by {@link localHourKey} or an upstream hourly timestamp. */
export function hourOf(key: string): number {
  return Number(key.slice(11, 13));
}

/** `14` → `"14:00"`; wraps past midnight. */
export function formatHour(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

/** A time range such as "14:00–16:00" (the separator can be changed for prose). */
export function formatWindow(startHour: number, hours: number, separator = '–'): string {
  return `${formatHour(startHour)}${separator}${formatHour(startHour + hours)}`;
}

/** Arithmetic mean; 0 for an empty list. */
export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Rounds to a number of decimal places. */
export function round(value: number, places = 0): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
