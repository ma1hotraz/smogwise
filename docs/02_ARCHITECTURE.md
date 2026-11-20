# 02 — Architecture

## 1. Stack

| Layer      | Choice                                                                                     | Why                                                                 |
| ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Language   | TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)              | Types are the first test                                            |
| UI         | **Preact 10** + hooks, Vite, plain CSS with design tokens                                  | ~4 kB runtime instead of ~60 kB; same component model               |
| Fonts      | System font stack                                                                          | Zero font bytes, native rendering, Devanagari supported by the OS   |
| Validation | zod 4 (`zod/mini` in shared/client code)                                                   | One schema for HTTP bodies, upstream data, model output and storage |
| Server     | Node 22+, Express 5, helmet, express-rate-limit, compression                               | Small, well-audited, familiar                                       |
| Air data   | Open-Meteo Air Quality + Geocoding APIs (CAMS model; free, no key)                         | Global coverage, hourly 48-hour forecast, no secret to leak         |
| AI         | Google Gemini via `@google/genai`, model from `GEMINI_MODEL`                               | Structured JSON output, low latency "flash" tier                    |
| Tests      | Vitest, Testing Library (Preact), vitest-axe, supertest, fast-check, Playwright + axe-core | Every layer tested, including accessibility                         |
| Deploy     | Vercel (static CDN + one serverless function); Dockerfile for Cloud Run                    | Same Express app everywhere                                         |

## 2. Runtime view

```
Browser (Preact)                              Server (Express)                     Upstream
──────────────────────────────────────        ──────────────────────────────        ─────────────
Intake ── zod parse ─► Profile (localStorage)
Profile + AirData ─► engine.buildPlan()  (pure, shared, < 2 ms, runs locally)
     │
     ├─ GET /api/geocode?q=…  ───────────────► validate → cache(24h) ──miss──► Open-Meteo geocoding
     ├─ GET /api/air?lat=…&lon=… (0.1°) ─────► validate → cache(30m) + in-flight de-dup ──► Open-Meteo AQ
     │                                          zod-validate upstream, trim to 48h
     ├─ POST /api/brief {context}  ──────────► validate → cache(15m) → Gemini → zod → fallback
     └─ POST /api/ask {question, context} ───► validate → red-flag check → Gemini → zod → fallback
```

If `/api/air` fails, the client uses the **seasonal fallback** for the city (bundled monthly
PM2.5 profile shape scaled by a typical level) or a PM2.5 value the user types; the source label
makes this explicit. If the AI routes fail, the client renders the deterministic brief/answer.

## 3. Folder tree

```
src/
  shared/                      pure, isomorphic, no I/O (lint-enforced)
    schema/                    zod schemas: profile, air, ai
    engine/
      aqi.ts                   A01/A06 index scales (NAQI, US AQI 2024), bands, cigarettes
      risk.ts                  A02–A03 sensitive groups and personal tier
      series.ts                A04–A05 clean/worst windows, trend, today's 24 hours
      location.ts              L02–L03 GRAP stage for Delhi NCR, reporting channels
      indoor.ts                I: mass-balance indoor model, purifier verdict
      hacks.ts                 H01–H11 ranked indoor hacks
      exposure.ts              E: inhaled dose by micro-environment
      routine.ts               R01–R09 time-slotted day
      swaps.ts                 S01–S09 alternatives with CO₂ / PM2.5 / dose impact
      community.ts             C01–C03 scaled impact, actions
      alerts.ts                AL01–AL06 safety alerts
      choices.ts               what-if choices and the engine's default recommendations
      fallbackAir.ts           seasonal estimate and manual reading
      plan.ts                  buildPlan(): orchestrates the above
      types.ts                 output types
      data/                    constants with sources, and user-facing copy
    ai/                        context builder, safety (red flags, sanitiser, number check), fallbacks
    samples.ts, time.ts        sample households; pure time helpers
  server/
    app.ts                     createApp(deps) — DI for upstream fetch, AI, clock, logger
    bootstrap.ts, index.ts     wiring from the environment; Node entry
    config.ts, logger.ts       env parsing with zod; JSON logs with redaction
    routes.ts                  health, geocode, air, brief, ask
    cache.ts                   TTL + LRU cache with in-flight de-duplication
    middleware/                security headers and limits, same-origin guard, errors
    upstream/openMeteo.ts      fixed-host fetch with timeout, size cap, schema validation
    ai/                        Gemini client, prompts, brief/ask service
  client/
    main.tsx, App.tsx          entry and shell (skip link, preferences)
    components/                Tabs, Fields, AirVisuals (band chip, hour strip), PlanBits (alerts, dose meter)
    features/intake/           samples, location combobox, household / travel / home fields
    features/plan/             air header, Today, Home air, Swaps panels and the plan view
    features/community/        scale, actions, printable notice (lazy)
    features/ask/              assistant panel (lazy)
    lib/                       api, storage, announcer, air hook, preferences, speech, what-if, lazy, focus
    styles/                    tokens.css, base.css, print.css
api/index.ts                   Vercel serverless entry (same Express app)
tests/                         unit, property, api, components, e2e, helpers
scripts/check-bundle.mjs       enforces bundle budgets and the client secret scan
```

## 4. Data models (summarised; source of truth is `src/shared/schema/`)

```ts
type Profile = {
  version: 1;
  location: {
    name: string;
    countryCode: string;
    admin1?: string;
    lat: number;
    lon: number;
    timezone: string;
  };
  household: {
    adults: number;
    under5: number;
    children: number;
    over65: number;
    pregnant: boolean;
    respiratory: boolean;
    heart: boolean;
  };
  lifestyle: {
    commute: { mode: CommuteMode; km: number; daysPerWeek: number; departHour: number };
    exercise: { kind: 'none' | 'outdoor' | 'indoor'; hour: number; minutes: number };
    cooking: 'lpg' | 'induction' | 'biomass';
    heating: 'none' | 'electric' | 'brazier' | 'wood' | 'kerosene';
    home: {
      tightness: 'leaky' | 'average' | 'sealed';
      roomM2: number;
      purifierCadr: number; /* 0 = none */
    };
    sources: {
      smoking: boolean;
      incense: boolean;
      mosquitoCoil: boolean;
      candles: boolean;
      drySweeping: boolean;
    };
    burnsWaste: boolean;
  };
};

type AirData = {
  source: 'open-meteo' | 'seasonal-fallback' | 'manual';
  fetchedAt: string; // ISO
  timezone: string;
  hourly: { time: string; pm25: number; pm10: number | null }[]; // local ISO, ≤ 48 entries
};

type Plan = {
  air: {
    pm25: number;
    index: number;
    band: Band;
    scale: 'NAQI' | 'US_AQI';
    trend: Trend;
    cigarettes: number;
    grap?: GrapStage;
  };
  tier: Tier;
  sensitive: SensitiveGroup[];
  windows: { clean: Window | null; worst: Window | null; meaningful: boolean };
  routine: RoutineStep[]; // { hour, title, detail, ruleId, impact? }
  alerts: Alert[]; // { level: 'emergency' | 'warning' | 'info', title, detail, ruleId }
  indoor: { ratio: number; homePm25: number; hacks: Hack[]; purifier: PurifierVerdict };
  swaps: Swap[]; // { id, title, co2KgWeek, pm25GWeek, doseDeltaPct, tradeOff?, ruleId }
  exposure: { baseline: Dose; withPlan: Dose }; // Dose = { totalUg, byPlace, cigarettes }
  community: CommunityAction[];
};
```

## 5. API contracts

All responses are JSON with `Cache-Control: no-store`; errors are `{ "error": "<code>" }`.

| Method | Path           | Request                                                                    | 200 response                                                                   | Errors                  |
| ------ | -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------- |
| GET    | `/api/health`  | —                                                                          | `{ ok: true, ai: 'enabled' \| 'disabled', version }`                           | —                       |
| GET    | `/api/geocode` | `q` 2–60 chars, letters/spaces/`.,'-()` incl. Unicode                      | `{ results: Place[] }` (≤ 5)                                                   | 400, 429, 502           |
| GET    | `/api/air`     | `lat` −90…90, `lon` −180…180 (rounded to 0.1 server-side too)              | `AirData` with `source: 'open-meteo'`                                          | 400, 429, 502           |
| POST   | `/api/brief`   | `{ context: AiContext }` (≤ 8 kB, `.strict()`)                             | `{ headline, summary, source: 'gemini' \| 'rules' }`                           | 400, 403, 413, 415, 429 |
| POST   | `/api/ask`     | `{ question: string(1..400), context: AiContext, language: 'en' \| 'hi' }` | `{ answer, citedRuleIds, followUps, source: 'gemini' \| 'rules' \| 'safety' }` | 400, 403, 413, 415, 429 |

`AiContext` is a _summary_ built by `src/shared/ai/context.ts` — city name, scale, PM2.5, band,
tier, sensitive groups, windows, top actions and dose figures. It never contains coordinates.

## 6. Architecture decisions (ADR summary)

| #   | Decision                                                      | Alternatives considered                      | Reason                                                                                  |
| --- | ------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| AD1 | Engine is pure TypeScript in `src/shared`, run in the browser | Run engine on the server; let the LLM decide | Instant plans, works offline, deterministic, 100% testable, explainable rule ids        |
| AD2 | Server proxies Open-Meteo                                     | Browser calls Open-Meteo directly            | CSP stays `connect-src 'self'`; shared cache across users; upstream schema validation   |
| AD3 | Preact + system fonts                                         | React + web fonts                            | ~55 kB less JS, zero font bytes; Efficiency                                             |
| AD4 | Gemini only writes words; outputs schema-validated            | Free-form chat                               | No hallucinated numbers; safe fallbacks; prompt-injection blast radius is text only     |
| AD5 | Location rounded to 0.1° in the browser                       | Exact coordinates                            | Privacy by design; also improves cache hit rate (≈ 11 km grid matches model resolution) |
| AD6 | No database, no accounts                                      | Firebase / Supabase                          | No personal data at rest; nothing to breach                                             |
| AD7 | Dependency injection for fetch, AI, clock, logger             | Module mocks                                 | Real app under test with fakes; no network in tests                                     |
