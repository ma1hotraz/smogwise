/** Clock hours and durations used by the routine rules (docs/03 R01–R09). */

/** Local hours at which routine steps are placed when the forecast does not decide. */
export const ROUTINE_HOURS = {
  morning: 7,
  shutAllDay: 8,
  airFreely: 9,
  play: 16,
  elderWalk: 17,
  cooking: 19,
  heating: 20,
  night: 22,
} as const;

/** Length of an airing burst: shorter on very unhealthy days (R02). */
export const AIRING_MINUTES = { normal: 10, short: 5 } as const;
