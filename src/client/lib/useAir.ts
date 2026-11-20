/**
 * Air data for a location: a seasonal estimate immediately (so the plan renders without the
 * network), replaced by live data when it arrives; or the user's own reading.
 */
import { useEffect, useState } from 'preact/hooks';

import { manualAir, seasonalAir } from '../../shared/engine/fallbackAir.js';
import { roundCoord, type AirData } from '../../shared/schema/air.js';
import type { Location } from '../../shared/schema/profile.js';
import { fetchAir } from './api.js';
import { loadCachedAir, saveCachedAir } from './storage.js';

export type AirStatus = 'loading' | 'live' | 'estimated' | 'manual';

export interface AirState {
  air: AirData;
  status: AirStatus;
}

function initial(location: Location, manual: number | null, now: Date): AirState {
  if (manual !== null) {
    return { air: manualAir(manual, location, now), status: 'manual' };
  }
  const cached = loadCachedAir(roundCoord(location.lat), roundCoord(location.lon), now.getTime());
  return cached
    ? { air: cached, status: 'live' }
    : { air: seasonalAir(location, now), status: 'loading' };
}

/** Loads air data; `manual` (µg/m³) overrides the forecast when set. */
export function useAir(location: Location, manual: number | null): AirState {
  const [state, setState] = useState<AirState>(() => initial(location, manual, new Date()));

  useEffect(() => {
    const now = new Date();
    const start = initial(location, manual, now);
    setState(start);
    if (start.status !== 'loading') {
      return undefined;
    }
    const controller = new AbortController();
    const lat = roundCoord(location.lat);
    const lon = roundCoord(location.lon);
    fetchAir(lat, lon, controller.signal)
      .then((air) => {
        saveCachedAir(lat, lon, air, Date.now());
        setState({ air, status: 'live' });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ air: start.air, status: 'estimated' });
        }
      });
    return () => {
      controller.abort();
    };
  }, [location, manual]);

  return state;
}
