/** Browser fakes for component tests: a scripted fetch keyed by API path. */
import { vi } from 'vitest';

import { airFrom, WINTER_DAY } from './fixtures.js';

/** A JSON body, a Response, or a function of the request that returns either. */
type Reply = unknown;

/** Stubs `fetch`: each route returns JSON (or a function result); unknown routes fail. */
export function stubApi(routes: Record<string, Reply> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    const path = url.split('?')[0] ?? url;
    if (!(path in routes)) {
      return Promise.reject(new TypeError('offline'));
    }
    const reply = routes[path];
    const body: unknown =
      typeof reply === 'function'
        ? (reply as (u: string, i?: RequestInit) => unknown)(url, init)
        : reply;
    if (body instanceof Response) {
      return Promise.resolve(body);
    }
    return Promise.resolve(Response.json(body));
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

/** Today in Delhi as live data, shaped like a winter day. */
export function liveAir() {
  const today = new Date().toISOString().slice(0, 10);
  return airFrom([...WINTER_DAY, ...WINTER_DAY], { date: today });
}
