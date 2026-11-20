# 10 — Build Plan and Submission Checklist

## 1. Phases (each ends with a green gate)

| Phase | Deliverable                                                                               | Gate                                                  |
| ----- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0     | Scaffold: package.json, TS configs, ESLint, Prettier, Vitest, Vite (Preact), hooks, CI    | `npm run lint && npm run typecheck` pass              |
| 1     | Shared schemas (profile, air, plan, api, ai) + engine data with sources                   | Schema unit tests                                     |
| 2     | Engine: aqi, risk, windows, location, indoor, exposure                                    | Unit + property tests, 100 % engine coverage so far   |
| 3     | Engine: routine, swaps, community, alerts, plan orchestrator, perf test                   | All engine tests, `buildPlan` < 2 ms                  |
| 4     | AI shared: context builder, fallback answers, brief template, red-flag detector           | Unit tests                                            |
| 5     | Server: app, security, cache, Open-Meteo upstream, routes, Gemini client                  | API tests incl. security and failure paths            |
| 6     | Client foundation: tokens, base styles, primitives (Tabs, Combobox, Meter, Toggle, Alert) | Component + axe tests                                 |
| 7     | Client features: Intake, Today, Home air, Swaps, Community, Ask                           | Component + axe tests, coverage gates                 |
| 8     | E2E: Playwright flows, axe matrix, reflow, keyboard, CSP                                  | `npm run test:e2e` green                              |
| 9     | Docs: README, SECURITY.md, CONTRIBUTING.md; measure bundle/Lighthouse                     | `npm run check` green; README numbers match output    |
| 10    | Deploy (Vercel) and record live URL                                                       | `/api/health` → `ai: enabled`; smoke test on live URL |

## 2. Definition of 100 — submission checklist

### Problem Statement Alignment

- [ ] README "How Smogwise meets the brief" table maps every phrase of the brief to a feature and a path.
- [ ] Live, location-specific forecast drives windows, routine and dose (not static tips).
- [ ] Families (sensitive members) and communities (Community tab) both served.
- [ ] Routine, indoor hacks and sustainable swaps each have impact numbers + rule ids.
- [ ] What-if toggles show the direct impact of choices live.
- [ ] GenAI: Daily brief + Ask Smogwise grounded on the plan; works in English and Hindi.
- [ ] Sample profiles show a full plan in one click.

### Security

- [ ] No secret in repo or bundle (CI grep + gitleaks).
- [ ] Strict CSP, HSTS, Permissions-Policy, COOP/CORP — tested on API and static.
- [ ] zod on every input, upstream response, model output and stored profile.
- [ ] Rate limits, body limits, 415, 403 cross-site — tested.
- [ ] Prompt-injection, number-check and red-flag tests pass.
- [ ] `npm audit --omit=dev --audit-level=high` clean; non-root container; SECURITY.md complete.

### Code Quality

- [ ] Lint zero warnings, typecheck clean, Prettier clean.
- [ ] No `any` / `ts-ignore` / unexplained `eslint-disable` in `src/`.
- [ ] Layer boundaries and engine purity enforced by lint.
- [ ] TSDoc on exported shared/server functions; size and complexity limits respected.
- [ ] CI workflow present and green; conventional commits.

### Testing

- [ ] Coverage gates met (paste summary in README).
- [ ] Property tests, API failure-path tests, component axe tests, e2e all green.
- [ ] No network in tests.

### Efficiency

- [ ] Bundle budgets pass; zero web fonts; lazy chunks exist.
- [ ] Caches + in-flight de-dup implemented and tested; token caps and timeouts set.
- [ ] Engine perf test passes; Lighthouse recorded.

### Accessibility

- [ ] 0 axe violations across views × themes × viewports.
- [ ] Keyboard-only e2e passes; skip link; visible focus; reflow at 320 px; reduced motion; forced colours.
- [ ] Chart has a table alternative; live regions announce plan, air and dose changes.
- [ ] Token contrast test passes for both themes.

## 3. Final report format

```
Tests: <n> unit/API/component · <n> property · <n> e2e — all passing
Coverage: statements <x>% · branches <x>% · engine <x>%
Bundle: initial <x> kB gz · total <x> kB gz · CSS <x> kB gz · fonts 0
Axe: 0 violations on <n> combinations
Live URL: <url>
```
