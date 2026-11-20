# 07 — Testing

## 1. Pyramid

| Layer      | Tool                                  | Scope                                                                     | Location            |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| Unit       | Vitest                                | Every engine module, schemas, formatters, cache, sanitiser, fallback      | `tests/unit/`       |
| Property   | fast-check (500 runs each)            | Engine invariants                                                         | `tests/property/`   |
| API        | supertest + fakes                     | Every route: success, validation, headers, limits, upstream & AI failures | `tests/api/`        |
| Component  | Testing Library (Preact) + vitest-axe | Every component and feature view, incl. axe                               | `tests/components/` |
| End-to-end | Playwright + @axe-core/playwright     | Real build, no API key, mocked upstream at the network layer              | `tests/e2e/`        |

No test touches the network: the server takes `fetchFn` and `ai` by injection; Playwright
routes `/api/air` and `/api/geocode` to fixtures.

## 2. Required cases

**Engine (unit)**

- A01 breakpoints at every edge for both scales (e.g. 9.0→50, 9.1→51, 30→50 NAQI, 380+→500).
- AC2: 100 µg/m³ → NAQI "Poor", US "Unhealthy".
- A03 tiers at every edge; sensitivity raises by one and caps at 5.
- A04 windows: picks the minimum block; ignores night hours; ignores past hours; tie → earliest;
  `meaningful` false for a flat forecast; null when fewer than 2 hours remain.
- A05 rising/falling/steady thresholds. A06 cigarettes (22 µg/m³ → 1).
- L02 GRAP inside/outside 60 km and each stage edge; L03 per country.
- Indoor model: reference room gives Δref exactly; purifier verdict thresholds; each hack's delta.
- Exposure: hand-computed fixture day matches to 1 µg; WFH removes commute; N95 factor.
- Swaps feasibility by distance and mode; signs; trade-off flags; fuel tables.
- Routine: each R rule fires on its condition and not otherwise.
- Alerts: AL01 for brazier/wood/kerosene always (AC6); AL04 at tier 5.
- Community: scaling and rounding.

**Property (fast-check)**

- Index is monotonic non-decreasing in PM2.5 for both scales and within 0–500.
- Adding a purifier, adding N95 or removing any indoor source never increases dose (AC5).
  (Sealing gaps can _raise_ indoor PM2.5 when outdoor air is cleaner than indoor air — found by
  this suite — so the engine only shows hacks with a positive modelled reduction.)
- Clean-window mean ≤ every other candidate block mean (AC4).
- `buildPlan` never throws for any valid profile and air series, and all numbers are finite.

**API**

- `/api/health` shape. `/api/geocode` valid, too short, bad characters, upstream 500 → 502.
- `/api/air` valid (rounded coords used in the upstream URL), out-of-range → 400, cache hit
  avoids second upstream call, in-flight de-dup, timeout → 502, oversized → 502, schema mismatch → 502.
- `/api/brief` and `/api/ask`: success with fake AI; disabled AI → `rules`; invalid JSON from model →
  fallback; invented number → fallback; unknown ids filtered; red flag → `safety` without AI call;
  injection text stays data; 400 on unknown keys; 413 over limit; 415 non-JSON; 403 cross-site; 429.
- Security headers on API and static responses; no `x-powered-by`; errors have no stack.

**Components** — render, interaction and axe for: Tabs, Combobox, Meter, Toggle, Alert, ForecastChart
(+ table), RoutineList, HackList, SwapList, CommunityPanel, AskPanel, Intake steps, App shell.

**E2E** — sample profile → Today in one click; own profile via keyboard only; toggling a swap
updates the meter and live region; Ask answers (no key); community print view; persistence after
reload; "Forget my data"; axe on every view in light/dark at 1280 px and 375 px; reflow at 320 px;
CSP has no violations (console listener).

## 3. Gates (CI fails below these)

| Metric                   | Threshold                    |
| ------------------------ | ---------------------------- |
| Statements / lines (all) | ≥ 95 %                       |
| Branches (all)           | ≥ 90 %                       |
| Functions (all)          | ≥ 95 %                       |
| `src/shared/engine/**`   | 100 % lines, ≥ 98 % branches |
| axe violations           | 0                            |
| e2e failures             | 0                            |
