/** Injected time source so tests control "now". */
export interface Clock {
  now(): Date;
}

/** Default production clock backed by the system time. */
export const systemClock: Clock = { now: () => new Date() };
