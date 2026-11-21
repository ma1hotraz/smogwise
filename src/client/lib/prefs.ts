/** Theme and text size (docs/06 §3), applied as attributes on <html>. */
import { useEffect, useState } from 'preact/hooks';

import { loadPrefs, type Prefs, savePrefs } from './storage.js';

/** Applies preferences to the document root. */
export function applyPrefs(prefs: Prefs, root: HTMLElement = document.documentElement): void {
  if (prefs.theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', prefs.theme);
  }
  root.setAttribute('data-text', prefs.textSize);
}

/** Preferences state that persists and applies itself. */
export function usePrefs(): [Prefs, (next: Prefs) => void] {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
  }, [prefs]);
  return [prefs, setPrefs];
}
