# 08 — Efficiency

## 1. Budgets (enforced by `scripts/check-bundle.mjs` in CI)

| Resource                    | Budget                            |
| --------------------------- | --------------------------------- |
| Initial JS (gzip)           | ≤ 35 kB                           |
| Total JS, all chunks (gzip) | ≤ 60 kB                           |
| CSS (gzip)                  | ≤ 8 kB                            |
| Web fonts                   | 0 bytes                           |
| Images                      | inline SVG only (favicon ≤ 1 kB)  |
| `buildPlan` median          | < 2 ms (asserted over 1,000 runs) |

## 2. Techniques

**Client**

- Preact instead of React (~55 kB saved); system fonts; no icon font (inline SVG symbols).
- Engine runs locally, so plans are instant and recompute synchronously on every toggle.
- The plan view (with the decision engine) is its own chunk, prefetched while the intake form is
  shown; Ask and Community load on first use.
- `useMemo` keyed on profile + air + choices; no re-render storms (components receive slices).
- Debounced city search (300 ms) with `AbortController` cancelling stale requests.
- Air data cached in `sessionStorage` per rounded location for 30 minutes.
- Immutable hashed assets cached for a year; `index.html` `no-cache`.

**Server**

- Shared TTL + LRU cache: air 30 min per 0.1° cell (≈ model resolution), geocode 24 h, brief 15
  min, answers 10 min; in-flight de-duplication so a burst makes one upstream call.
- Upstream responses trimmed to 48 hours and the fields the engine uses before caching.
- `compression`, small JSON payloads (an air response ≈ 3 kB gzip).
- AI: token caps, minimal thinking, one retry with jitter, timeouts via `AbortSignal`.
- Single bundled server file (esbuild); runtime deps: express, helmet, express-rate-limit,
  compression, zod, @google/genai.

## 3. Measuring

- `npm run build && node scripts/check-bundle.mjs` prints sizes and fails on budget breach.
- `tests/unit/engine/perf.test.ts` asserts the `buildPlan` budget on the median of 1,000 runs (robust on a busy CI machine).
