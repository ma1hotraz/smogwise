/** Moves focus to an element once it mounts (used for view headings after navigation). */
import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

export function useFocusOnMount(ref: RefObject<HTMLElement>, enabled: boolean): void {
  useEffect(() => {
    if (enabled) {
      ref.current?.focus();
    }
  }, [ref, enabled]);
}
