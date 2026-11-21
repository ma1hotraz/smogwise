/** Small numeric helpers shared by the engine, schemas and server. */

/** Arithmetic mean; 0 for an empty list. */
export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Rounds to a number of decimal places. */
export function round(value: number, places = 0): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/** Percentage change from `before` to `after`, rounded (negative = reduction; 0 when `before` is 0). */
export function percentChange(before: number, after: number): number {
  return before === 0 ? 0 : Math.round(((after - before) / before) * 100);
}

/** Percentage reduction from `before` to `after`, rounded (negative = increase; 0 when `before` is 0). */
export function reductionPct(before: number, after: number): number {
  return before === 0 ? 0 : Math.round((1 - after / before) * 100);
}
