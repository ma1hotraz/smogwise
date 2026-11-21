# 10 — Build Plan and Quality Gates

## 1. Phases (all complete; each ended with a green gate)

| Phase | Deliverable                                                                                          | Gate                                       |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 0     | Scaffold: package.json, TS configs, ESLint, Prettier, Vitest, Vite (Preact), hooks, CI               | `npm run lint && npm run typecheck`        |
| 1     | Shared schemas (profile, air, ai) and engine data with sources                                       | Schema unit tests                          |
| 2     | Engine: aqi, risk, series, location, indoor, exposure                                                | Unit + property tests                      |
| 3     | Engine: routine, hacks, swaps, community, alerts, what-if, plan orchestrator, perf test              | All engine tests; `buildPlan` < 2 ms       |
| 4     | Shared AI: context builder, safety layer, rules answers, brief template                              | Unit tests                                 |
| 5     | Server: app, security, cache, Open-Meteo upstream, routes, Gemini client and services                | API tests incl. security and failure paths |
| 6     | Client foundation: tokens, stylesheets, Tabs, form fields, BandChip, HourStrip, AlertList, DoseMeter | Component + axe tests                      |
| 7     | Client features: intake, Today, Home air, Swaps, Community, Ask, view-model hooks                    | Component + axe tests, coverage gates      |
| 8     | E2E: Playwright flows, axe on every view and theme, reflow, keyboard, text spacing, targets          | `npm run test:e2e`                         |
| 9     | Docs: README, SECURITY.md, CONTRIBUTING.md; bundle budgets measured                                  | `npm run check`                            |
| 10    | Deploy to Vercel; live smoke test (health, air, geocode, Gemini, headers)                            | `/api/health` reports `ai: enabled`        |

## 2. Quality gates (run in CI on every push)

| Parameter                | Gate                                                                                   | Command                      |
| ------------------------ | -------------------------------------------------------------------------------------- | ---------------------------- |
| Code quality             | ESLint strict, zero warnings; size and complexity limits; layer boundaries; no console | `npm run lint`               |
| Code quality             | No unused files, exports or dependencies                                               | `npm run lint:dead` (knip)   |
| Code quality             | Zero duplicated blocks in source and tests                                             | `npm run lint:dupes` (jscpd) |
| Code quality             | Formatting                                                                             | `npm run format`             |
| Code quality             | Strict TypeScript, both projects                                                       | `npm run typecheck`          |
| Testing                  | Unit, property, API and component tests with coverage thresholds                       | `npm test`                   |
| Efficiency, security     | Bundle budgets; no Gemini key in the client bundle                                     | `npm run check:bundle`       |
| Security                 | No high-severity runtime vulnerabilities                                               | `npm audit --omit=dev`       |
| Accessibility, alignment | End-to-end flows with axe on every view, both themes, desktop and mobile               | `npm run test:e2e`           |
| Security                 | No secrets in the full git history                                                     | gitleaks (checksum-verified) |

`npm run check` runs every local gate except e2e in one command. Current results are listed in the
README under "Evaluation focus areas".
