/** "Use my location": the browser position, rounded to 0.1° (~11 km) before it is used. */
import { useState } from 'preact/hooks';

import { roundCoord } from '../../../shared/schema/air.js';
import type { Location } from '../../../shared/schema/profile.js';
import { countryFromTimezone } from '../../lib/geo.js';

const POSITION_OPTIONS: PositionOptions = { maximumAge: 600_000, timeout: 10_000 };

/** A Location for a position, in the device's timezone. */
export function placeFromPosition(position: GeolocationPosition, timezone: string): Location {
  return {
    name: 'Your area',
    countryCode: countryFromTimezone(timezone),
    lat: roundCoord(position.coords.latitude),
    lon: roundCoord(position.coords.longitude),
    timezone,
  };
}

/** Status text and a `locate` action; the geolocation API is injectable for tests. */
export function useMyLocation(
  geolocation: Geolocation | undefined = 'geolocation' in navigator
    ? navigator.geolocation
    : undefined,
) {
  const [status, setStatus] = useState('');
  const locate = (onFound: (place: Location) => void): void => {
    if (!geolocation) {
      setStatus('Location is not available in this browser. Search for your city instead.');
      return;
    }
    setStatus('Finding your area…');
    geolocation.getCurrentPosition(
      (position) => {
        onFound(placeFromPosition(position, Intl.DateTimeFormat().resolvedOptions().timeZone));
        setStatus('Using your area, rounded to about 11 km.');
      },
      () => {
        setStatus('Location permission was not given. Search for your city instead.');
      },
      POSITION_OPTIONS,
    );
  };
  return { status, locate };
}
