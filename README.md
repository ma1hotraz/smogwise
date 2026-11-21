# Smogwise — clean air through smog season

> **Smogwise** (smog + wise) is a GenAI-powered assistant that helps families and
> communities get through severe winter smog. It reads the live air-quality forecast for **your**
> location, combines it with **your** household and lifestyle, and plans a low-emission day —
> when to air the home, exercise and travel, which indoor fixes help most, which sustainable swaps
> to make — and shows the **direct impact** of every choice in numbers.

**Chosen vertical:** [Challenge 6] Urban Air Quality Assistant · **Live demo:** https://smogwise.vercel.app

---

## What it does

| Tab                | What the family gets                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**          | A plain sentence about today's air, a 24-hour PM2.5 strip with the cleanest window, safety alerts, a Gemini-written brief (with read-aloud), what you breathe in today vs. with the plan, and an hour-by-hour routine |
| **Home air**       | A mass-balance model of the main room: indoor PM2.5, a purifier verdict (CADR needed vs. owned) and ranked fixes with their modelled reduction                                                                        |
| **Swaps & impact** | Alternatives for commute, cooking, heating and waste with **g PM2.5/week, kg CO₂/week and the change in your own dose** — honest trade-offs included. Tick one and the whole day recomputes                           |
| **Community**      | Scale the household's swaps to a housing society or school (1–1,000 households), local actions, and a printable noticeboard notice                                                                                    |
| **Ask Smogwise**   | Questions about _this_ plan, answered by Gemini in English or Hindi, grounded on the plan's figures; red-flag symptoms get a fixed emergency answer                                                                   |

Four **sample households** (Delhi, Lahore, Beijing, Gurugram) show a complete plan in one click.

## How Smogwise meets the brief

| Phrase in the brief                                     | Implementation                                                                                         | Code                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| "GenAI-powered assistant"                               | Gemini daily brief + Ask Smogwise, schema-validated, grounded on the plan                              | `src/server/ai/`, `src/shared/ai/`                                              |
| "families and communities"                              | Sensitive members (under-5, 65+, pregnancy, asthma/COPD, heart) tighten advice; Community tab          | `src/shared/engine/risk.ts`, `src/shared/engine/community.ts`                   |
| "severe winter smog and urban air pollution"            | Live 48-hour PM2.5 forecast, India NAQI / US AQI, Delhi NCR GRAP stage, carbon-monoxide alerts         | `src/server/upstream/openMeteo.ts`, `src/shared/engine/aqi.ts`, `alerts.ts`     |
| "low-emission daily routines"                           | Time-slotted routine (airing, exercise, commute, cooking, sleep) from the forecast's windows           | `src/shared/engine/routine.ts`, `series.ts`                                     |
| "indoor air quality hacks"                              | Mass-balance indoor model, purifier sizing, ranked hacks, myth-busters                                 | `src/shared/engine/indoor.ts`, `hacks.ts`                                       |
| "sustainable alternatives"                              | Commute, carpool, WFH, cooking fuel, heating and composting swaps                                      | `src/shared/engine/swaps.ts`                                                    |
| "tailored to their location"                            | City search or rounded geolocation → forecast, local index scale, local time, reporting channel        | `src/client/features/intake/LocationField.tsx`, `src/shared/engine/location.ts` |
| "and lifestyle"                                         | Commute mode/distance/days/time, exercise, fuels, heating, home tightness, room size, purifier, habits | `src/shared/schema/profile.ts`                                                  |
| "clearly explaining the direct impact of their choices" | Every card shows an impact figure and its rule id; what-if toggles recompute the inhaled dose live     | `src/shared/engine/exposure.ts`, `src/shared/engine/whatIf.ts`                  |

## Approach and logic: rules for numbers, AI for words

| Concern                                              | Who decides          | Why                                       |
| ---------------------------------------------------- | -------------------- | ----------------------------------------- |
| Band, tier, windows, dose, CO₂, PM2.5, purifier size | Deterministic engine | Must be correct, explainable and testable |
| Explaining the day, answering questions, Hindi       | Gemini               | Natural language and personalisation      |
| Emergencies (chest pain, can't breathe…)             | Fixed safety answer  | Never left to a model                     |
| Changing the plan                                    | The user's toggles   | Agency; the model has no tools            |

The model **never invents a number**: answers containing a figure that is not in the plan's
context are rejected and replaced by the rule-based answer.

### Decision rules (summary — full table with sources in [`docs/03_DECISION_ENGINE.md`](docs/03_DECISION_ENGINE.md))

| Rule       | Logic                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A01        | Index scale by country: India → CPCB NAQI, elsewhere → US EPA AQI (2024 breakpoints)                                                |
| A02–A03    | Health tier from PM2.5 (WHO/EPA thresholds); a sensitive household is advised one tier stricter                                     |
| A04        | Cleanest and worst 2-hour waking blocks in the next 24 h; "no meaningfully cleaner time" when the gap is small                      |
| A06        | 22 µg/m³ for a day ≈ 1 cigarette (Berkeley Earth)                                                                                   |
| L02–L03    | Indicative GRAP stage within 60 km of Delhi; where to report open burning by country                                                |
| I, H01–H11 | Indoor PM2.5 = `(P·a·C_out + E/V) / (a + k + CADR/V)`; hacks shown only if they reduce it (sealing can trap indoor smoke)           |
| E          | Inhaled dose = Σ concentration × breathing rate × time, over sleep, home, work, commute and exercise                                |
| R01–R09    | Windows shut until the clean window, airing bursts, exercise moved or indoors, N95/metro, children, elders, cooking, heating, night |
| S01–S09    | Swaps feasible for the distance and context, with weekly CO₂, PM2.5 and personal-dose change                                        |
| C01–C03    | Community scaling, tree-year equivalence, context-picked actions                                                                    |
| AL01–AL06  | Carbon monoxide, sensitive groups, warning signs, emergency smog, pregnancy, estimated data                                         |

## How it works

```
Browser (Preact)                                Server (Express)                      Upstream
Intake / sample ─► Profile (localStorage, zod)
Profile + air ─► engine.buildPlan()   (pure, in the browser, < 2 ms)
  GET  /api/geocode?q=…         ──────────────► zod → cache 24 h ───────────────────► Open-Meteo geocoding
  GET  /api/air?lat&lon (0.1°)  ──────────────► zod → cache 30 min + de-dup ─────────► Open-Meteo air quality (CAMS)
  POST /api/brief {context}     ──────────────► zod → cache → Gemini → zod → number check → fallback
  POST /api/ask {q, context}    ──────────────► red-flag check → sanitise → Gemini → zod → id filter → fallback
```

The plan appears instantly from a seasonal estimate and is replaced by live data when it arrives.
If the server is unreachable, the browser uses the same deterministic fallbacks, so every feature
keeps working offline or without an API key.

```
src/shared/   pure, isomorphic: schemas (zod/mini), decision engine, AI context + fallbacks
src/server/   Express app, security middleware, Open-Meteo client, Gemini client and service
src/client/   Preact views, accessible components, storage, API client
api/index.ts  Vercel serverless entry (same Express app)
docs/         spec, architecture, engine rules, AI, security, accessibility, testing, plan
tests/        unit, property, api, components, e2e
```

## Evaluation focus areas — evidence

### Code quality

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), **no `any`**, no
  `@ts-ignore`, no non-null assertions in `src/`.
- ESLint strict-type-checked + jsx-a11y strict, **zero warnings**; complexity ≤ 10, functions ≤ 40
  lines (components ≤ 60), files ≤ 250 lines; layer boundaries and engine purity (`Date.now`, `Math.random`, `fetch`
  banned in the engine) are **lint-enforced** ([`eslint.config.js`](eslint.config.js)).
- No `console` statements anywhere (lint-enforced repo-wide); no code or style file over 300 lines.
- Single responsibility in the UI: components only render; data, state and announcements live
  in view-model hooks (`usePlanModel`, `useBrief`, `useAsk`, `useReadAloud`, `useAir`).
- No dead code (knip) and **zero duplicated blocks** (jscpd), both enforced in CI; colour tokens
  are defined once for both themes with CSS `light-dark()`.
- Dependency injection on the server for fetch, the AI client, clock and logger (the assistant is
  chosen once in the composition root, `src/server/bootstrap.ts`); copy kept apart from logic
  ([`src/shared/engine/data/copy.ts`](src/shared/engine/data/copy.ts)); every constant cites its source.
- CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, dead code (knip), duplication (jscpd, zero clones), format, typecheck, tests with
  coverage gates, build, bundle budgets, `npm audit`, Playwright and gitleaks. Pre-commit hook in `.githooks/`.

### Security — details in [SECURITY.md](SECURITY.md)

- Gemini key only in the server environment; the build fails if the client bundle mentions it.
- Strict CSP (no `unsafe-inline`/`unsafe-eval`), HSTS, nosniff, COOP/CORP, frame-ancestors none,
  Permissions-Policy (geolocation for this origin only) — same headers in `vercel.json` (tested to match).
- Strict zod schemas (unknown keys rejected) on every query and body, model output, stored
  profile and server reply; Open-Meteo responses validated for the fields used;
  16 kB JSON limit, 415 for non-JSON, 403 for cross-site POSTs, per-IP rate limits (429 tested).
- Upstream: fixed hosts, `URLSearchParams`, 5 s timeout, 512 kB cap, schema validation (no SSRF).
- LLM: deterministic red-flag routing, sanitised and delimited questions, structured output,
  rule-id whitelist, **hallucinated-number check**, text-only rendering; OWASP LLM Top 10 mapped.
- Privacy: coordinates rounded to 0.1° in the browser, profile only in `localStorage`, no cookies,
  no analytics, no server storage; the model never sees coordinates.

### Efficiency

| Metric                      | Budget  | Measured                 |
| --------------------------- | ------- | ------------------------ |
| Initial JS (gzip)           | ≤ 35 kB | **25.4 kB**              |
| Total JS, all chunks (gzip) | ≤ 60 kB | **43.0 kB**              |
| CSS (gzip)                  | ≤ 8 kB  | **2.8 kB**               |
| Web fonts                   | 0       | **0** (system fonts)     |
| `buildPlan`                 | < 2 ms  | asserted over 1,000 runs |

Preact instead of React; the plan view (engine) is its own chunk, prefetched while the intake is
shown; Ask and Community load on demand. Server: shared TTL/LRU caches with in-flight
de-duplication (one upstream call per 0.1° cell per 30 min), the brief waits for live data (one
model call per visit), token caps, timeouts, one retry with jitter, compression.
`npm run check:bundle` enforces the budgets.

### Testing

```bash
npm test          # Vitest with coverage gates (fails below them)
npm run test:e2e  # Playwright on the production build, no API key, upstream routed to fixtures
```

**358** unit, property, API and component tests · **24** end-to-end runs (12 tests × desktop and mobile).
Coverage: **100 % statements · 100 % functions · 100 % lines · 96.9 % branches**; the
decision engine is at 100 % on every measure. Property tests (fast-check, 500 runs each) prove: the index is monotonic; a
purifier, an N95 or removing an indoor source never increases dose; the clean window is never
beaten; `buildPlan` never throws. The property suite found a real modelling edge case — sealing a
home raises indoor PM2.5 when outdoor air is cleaner — so hacks are now shown only when they help.
No test touches the network.

### Accessibility — WCAG 2.2 AA ([docs/06_ACCESSIBILITY.md](docs/06_ACCESSIBILITY.md))

- **Zero axe violations** on every view, in light and dark themes, on desktop and mobile, and with
  forced colours + reduced motion (Playwright + axe-core); axe in every component test.
- Contrast asserted over the design tokens for both themes (57 checks: text ≥ 4.5:1, graphics ≥ 3:1).
- Skip link, landmarks, one `h1` per view with focus moved to it after navigation; WAI-ARIA tabs and
  ARIA 1.2 combobox; the chart has a text summary and an equivalent data table; bands use shape +
  label, never colour alone; live-region announcements for plan, data and dose changes.
- Keyboard-only end-to-end flow; reflow at 320 px with no horizontal scroll; text size 100/115/130 %.
- Inclusive by design: Hindi answers, read-aloud, free and low-cost fixes ranked first, works offline.

## Run it

```bash
nvm use            # Node 22+
npm ci
cp .env.example .env.local   # optional: add GEMINI_API_KEY; without it AI falls back to rules
npm run dev        # http://localhost:5173 (API on :8080)
npm run check      # lint, dead code, duplication, format, typecheck, tests, build, budgets
npm run test:e2e   # Playwright end-to-end and accessibility tests on the production build
```

Deploy: Vercel (static client + `api/index.ts`), or `docker build` for Cloud Run. Set
`GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the host's secret store.

### Demo video

`npm run demo` drives the live site (real air data and Gemini) in Chromium and records
`demo/raw/*.webm` with on-screen captions; set `BASE_URL` to record another deployment. Convert
for upload with:

```bash
ffmpeg -i demo/raw/*.webm -c:v libx264 -crf 22 -pix_fmt yuv420p -movflags +faststart demo/smogwise-demo.mp4
```

## Assumptions

- **Not medical advice.** Smogwise never names medicines or doses; red-flag symptoms always get the
  emergency answer.
- Exposure, indoor and emission figures use **published averages** (EPA, CPCB, WHO, India GHG
  Program, CEA, EMEP/EEA, peer-reviewed studies — cited in `docs/03_DECISION_ENGINE.md`). They are estimates for
  comparing choices for one adult on a typical day, and are labelled as such.
- The forecast is the CAMS model via Open-Meteo, not a ground monitor; the source is always shown,
  and a local reading can be entered instead.
- The GRAP stage is indicative (computed from hourly PM2.5, not the official 24-hour average).
- "Use my location" infers the country from the device timezone for a few smog-prone countries;
  elsewhere the US AQI scale is used.
- No accounts and no server-side storage, by design.

## Docs

The full design process is in [`docs/`](docs/00_INDEX.md): product spec, architecture, decision
engine with sources, AI integration, security, accessibility, testing, efficiency, code quality and
the build plan with the "definition of 100" checklist.

## License

[MIT](LICENSE)
