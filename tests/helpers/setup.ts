import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach, expect, vi } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

/** jsdom has no matchMedia; report "no match" so dark-only and motion branches stay off. */
function polyfillMatchMedia(): void {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
}

if (typeof document !== 'undefined') {
  polyfillMatchMedia();
}

/** No test may touch the network: fetch throws unless a test stubs it. */
beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('network disabled in tests');
  });
});

afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/preact');
    cleanup();
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    sessionStorage.clear();
  }
  vi.unstubAllGlobals();
});
