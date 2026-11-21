# 09 — Code Quality

## 1. Conventions

| Rule                  | Limit / practice                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| File length           | ≤ 250 lines in `src/` (data tables excepted); no code or style file over 300 lines                                |
| Function length       | ≤ 40 lines (components ≤ 60) in `src/`; test files are exempt (their `describe` blocks group cases)               |
| Cyclomatic complexity | ≤ 10                                                                                                              |
| Nesting depth         | ≤ 3                                                                                                               |
| Types                 | No `any`, no `@ts-ignore`, no non-null assertions in `src/`                                                       |
| Naming                | Domain words from the spec (tier, window, dose, swap, hack)                                                       |
| Comments              | TSDoc on every exported function in `shared` and `server`; rule ids in code match docs/03                         |
| Magic numbers         | Domain constants (with sources) live in `engine/data/*` and `shared/limits.ts`; other numbers are named constants |
| Errors                | Typed results at boundaries; no swallowed errors; generic HTTP errors                                             |
| Console               | No `console` anywhere, scripts included (`no-console`, repo-wide); scripts write to stdout                        |
| Side effects          | Injected (fetch, AI, clock, logger, storage)                                                                      |

## 2. Layer boundaries (lint-enforced with `no-restricted-imports`)

- `src/shared/**` imports nothing from `client`, `server`, `preact`, `express` or `node:*`.
- `src/client/**` never imports `src/server/**`, and vice versa.
- `src/shared/engine/**` bans `Date.now`, `Math.random` and `fetch` (`no-restricted-globals`,
  `no-restricted-properties`).

## 3. Tooling

- ESLint 9 flat config: `typescript-eslint` strict-type-checked + stylistic, `jsx-a11y` strict,
  `react` + `react-hooks` (Preact compatible), complexity and size rules.
- Prettier, EditorConfig, `.nvmrc`.
- Git hooks (`.githooks/pre-commit`): lint, format, typecheck.
- **CI** (`.github/workflows/ci.yml`): install → lint → dead code (knip) → duplication (jscpd, zero
  clones) → format → typecheck → unit/API/component
  tests with coverage → build → bundle budget → client bundle secret scan → `npm audit` →
  Playwright e2e → gitleaks.
- Dependabot for npm and GitHub Actions.

## 4. Repository hygiene

- Conventional commits, one commit per build phase, single `main` branch.
- No build output, coverage, videos or screenshots committed.
- README, SECURITY.md, CONTRIBUTING.md, LICENSE (MIT), CODEOWNERS, PR template.
- Every README claim points to a path that exists; numbers in the README come from scripts.

## 5. Review checklist (run before every commit)

- [ ] Names say what, not how; no dead code; no commented-out code.
- [ ] New logic has tests; new UI has an axe test.
- [ ] Rule ids and constants match `docs/03_DECISION_ENGINE.md`.
- [ ] No new runtime dependency without a reason in the commit body.
