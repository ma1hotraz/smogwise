/** Combobox behaviour for the city search: query, active option, results and keyboard (ARIA 1.2). */
import { useState } from 'preact/hooks';

import type { Location } from '../../../shared/schema/profile.js';
import { placeLabel } from '../../lib/geo.js';
import { usePlaceSearch } from './usePlaceSearch.js';

/** Next active option for an arrow key, wrapping around; unchanged for other keys. */
export function nextActive(key: string, current: number, count: number): number {
  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  return step === 0 ? current : (current + step + count) % Math.max(count, 1);
}

/** Combobox state: the typed query, the active option, the search results and key handling. */
export function usePlaceCombobox(value: Location | null, onChange: (location: Location) => void) {
  const selectedLabel = value ? placeLabel(value) : '';
  const [query, setQuery] = useState(selectedLabel);
  const [active, setActive] = useState(-1);
  const { results, status, clear } = usePlaceSearch(query, selectedLabel);
  const open = results.length > 0;

  const choose = (place: Location): void => {
    onChange(place);
    setQuery(placeLabel(place));
    setActive(-1);
    clear();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const chosen = event.key === 'Enter' && open ? results[active] : undefined;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || chosen) {
      event.preventDefault();
    }
    if (chosen) {
      choose(chosen);
    } else if (event.key === 'Escape') {
      clear();
    } else {
      setActive((current) => nextActive(event.key, current, results.length));
    }
  };

  const type = (text: string): void => {
    setQuery(text);
    setActive(-1);
  };
  return { query, type, active, results, status, open, choose, onKeyDown };
}
