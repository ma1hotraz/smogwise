/** Limits shared by schemas, server, client and form fields, so each lives in one place. */

/** Longest question Ask Smogwise accepts, in characters. */
export const MAX_QUESTION_CHARS = 400;

/** Highest PM2.5 (µg/m³) accepted anywhere: a manual reading, an upstream value, a purifier CADR. */
export const MAX_PM25 = 2000;

/** Largest purifier clean-air delivery rate accepted, in m³/h. */
export const MAX_CADR = 2000;
