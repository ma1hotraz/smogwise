/**
 * City search (ARIA 1.2 combobox with a listbox popup) plus "Use my location" (docs/02 AD5,
 * docs/06 §2). Search, key handling and geolocation live in hooks; this file renders.
 */
import type { RefObject } from 'preact';

import type { Location } from '../../../shared/schema/profile.js';
import { placeLabel } from '../../lib/geo.js';
import { useMyLocation } from './useMyLocation.js';
import { usePlaceCombobox } from './usePlaceCombobox.js';

interface LocationFieldProps {
  value: Location | null;
  error: string | null;
  inputRef?: RefObject<HTMLInputElement>;
  onChange: (location: Location) => void;
}

interface ListboxProps {
  results: readonly Location[];
  active: number;
  onChoose: (place: Location) => void;
}

function PlaceListbox({ results, active, onChoose }: ListboxProps) {
  return (
    <div id="place-list" role="listbox" aria-label="Matching places" hidden={results.length === 0}>
      {results.map((place, index) => (
        <div
          key={`${place.name}-${place.lat}-${place.lon}`}
          id={`place-${index}`}
          role="option"
          tabIndex={-1}
          aria-selected={index === active}
          onMouseDown={(event) => {
            event.preventDefault();
            onChoose(place);
          }}
        >
          {placeLabel(place)}
        </div>
      ))}
    </div>
  );
}

export function LocationField({ value, error, inputRef, onChange }: LocationFieldProps) {
  const { query, type, active, results, status, open, choose, onKeyDown } = usePlaceCombobox(
    value,
    onChange,
  );
  const geo = useMyLocation();
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
          ref={inputRef ?? null}
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
            type(event.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
        />
        <PlaceListbox results={results} active={active} onChoose={choose} />
      </div>
      <span class="hint" id="place-status" role="status">
        {geo.status || status}
      </span>
      <div>
        <button
          class="button button-quiet button-small"
          type="button"
          onClick={() => {
            geo.locate(choose);
          }}
        >
          Use my location
        </button>
      </div>
    </div>
  );
}
