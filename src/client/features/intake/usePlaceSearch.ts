/** Debounced, abortable place search with an announced status (docs/06 §2 combobox). */
import { useEffect, useState } from 'preact/hooks';

import type { Location } from '../../../shared/schema/profile.js';
import { searchPlaces } from '../../lib/api.js';

const DEBOUNCE_MS = 300;

/** Places matching `query`; nothing is searched for the label of the place already chosen. */
export function usePlaceSearch(query: string, selectedLabel: string) {
  const [results, setResults] = useState<Location[]>([]);
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
