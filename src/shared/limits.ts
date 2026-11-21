/** Limits shared by schemas, server, client and form fields, so each lives in one place. */

/** Longest question Ask Smogwise accepts, in characters. */
export const MAX_QUESTION_CHARS = 400;

/** Highest PM2.5 (µg/m³) accepted anywhere: a manual reading or an upstream value. */
export const MAX_PM25 = 2000;

/** Largest purifier clean-air delivery rate accepted, in m³/h. */
export const MAX_CADR = 2000;

/** Largest number of people per household group the intake form accepts. */
export const HOUSEHOLD_MAX = { adults: 12, over65: 8, under5: 8, children: 10 } as const;

/** Longest one-way commute accepted, in km. */
export const MAX_COMMUTE_KM = 80;

/** Days in a week: the upper bound for commute days. */
export const DAYS_PER_WEEK = 7;

/** Longest exercise session accepted, in minutes. */
export const MAX_EXERCISE_MIN = 180;

/** Main room floor area accepted, in m². */
export const ROOM_M2 = { min: 6, max: 100 } as const;

/** How long an air reading stays fresh, in ms: the server cache and the browser copy both use it. */
export const AIR_FRESH_MS = 30 * 60_000;

/** Most alerts passed to the assistant in one context. */
export const MAX_ALERTS = 6;
