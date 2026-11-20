/**
 * City search (ARIA 1.2 combobox with a listbox popup) plus "Use my location", which rounds the
 * position to 0.1° in the browser before it is used anywhere (docs/02 AD5).
 */
import { useEffect, useState } from 'preact/hooks';

import { roundCoord, type Place } from '../../../shared/schema/air.js';
import type { Location } from '../../../shared/schema/profile.js';
import { searchPlaces } from '../../lib/api.js';
import { countryFromTimezone, placeLabel } from '../../lib/geo.js';

interface LocationFieldProps {
  value: Location | null;
  error: string | null;
  onChange: (location: Location) => void;
}

const DEBOUNCE_MS = 300;

function useSearch(query: string, selectedLabel: string) {
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === selectedLabel) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus('Searching…');
      searchPlaces(q, controller.signal)
        .then((places) => {
          setResults(places);
          setStatus(
            places.length === 0
              ? 'No places found. Try a nearby city.'
              : `${places.length} places found.`,
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setStatus('Place search is unavailable. Try “Use my location”.');
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedLabel]);
  return {
    results,
    status,
    clear: () => {
      setResults([]);
    },
  };
}

export function LocationField({ value, error, onChange }: LocationFieldProps) {
  const selectedLabel = value ? placeLabel(value) : '';
  const [query, setQuery] = useState(selectedLabel);
  const [active, setActive] = useState(-1);
  const [geoStatus, setGeoStatus] = useState('');
  const { results, status, clear } = useSearch(query, selectedLabel);
  const open = results.length > 0;

  const choose = (place: Place): void => {
    onChange(place);
    setQuery(placeLabel(place));
    setActive(-1);
    clear();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter' && open && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape') {
      clear();
    }
  };

  const useMyLocation = (): void => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Location is not available in this browser. Search for your city instead.');
      return;
    }
    setGeoStatus('Finding your area…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const place: Location = {
          name: 'Your area',
          countryCode: countryFromTimezone(timezone),
          lat: roundCoord(position.coords.latitude),
          lon: roundCoord(position.coords.longitude),
          timezone,
        };
        choose(place);
        setGeoStatus('Using your area, rounded to about 11 km.');
      },
      () => {
        setGeoStatus('Location permission was not given. Search for your city instead.');
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const describedBy = ['place-hint', error ? 'place-error' : '', 'place-status']
    .filter(Boolean)
    .join(' ');
  return (
    <div class="field">
      <label htmlFor="place">City or town</label>
      <span class="hint" id="place-hint">
        Start typing, then choose from the list. Only the city goes to the server.
      </span>
      {error ? (
        <span class="error" id="place-error">
          {error}
        </span>
      ) : null}
      <div class="combo">
        <input
          id="place"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="place-list"
          aria-activedescendant={open && active >= 0 ? `place-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={query}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
        <div id="place-list" role="listbox" aria-label="Matching places" hidden={!open}>
          {results.map((place, index) => (
            <div
              key={`${place.name}-${place.lat}-${place.lon}`}
              id={`place-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
            >
              {placeLabel(place)}
            </div>
          ))}
        </div>
      </div>
      <span class="hint" id="place-status" role="status">
        {geoStatus || status}
      </span>
      <div>
        <button class="button button-quiet button-small" type="button" onClick={useMyLocation}>
          Use my location
        </button>
      </div>
    </div>
  );
}
