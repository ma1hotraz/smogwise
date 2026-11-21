/** The current time, refreshed on an interval so time-of-day advice never goes stale. */
import { useEffect, useState } from 'preact/hooks';

const REFRESH_MS = 5 * 60_000;

/** `clock` is injectable for tests; the default is the system time. */
export function useNow(clock: () => Date = () => new Date(), refreshMs = REFRESH_MS): Date {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(clock());
    }, refreshMs);
    return () => {
      clearInterval(timer);
    };
  }, [clock, refreshMs]);
  return now;
}
