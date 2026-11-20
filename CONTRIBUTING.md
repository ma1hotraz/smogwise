# Contributing

1. `nvm use && npm ci` (Node 22+). The `prepare` script enables the pre-commit hook in `.githooks/`.
2. Read [`docs/00_INDEX.md`](docs/00_INDEX.md); decision rules live in
   [`docs/03_DECISION_ENGINE.md`](docs/03_DECISION_ENGINE.md) and their ids must match the code.
3. Make the change with tests. New UI needs an axe check; new engine logic needs unit tests and, for
   invariants, a property test.
4. `npm run check` (lint, format, typecheck, tests with coverage gates, build, bundle budgets) and
   `npm run test:e2e` must pass.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
   `test:`, `refactor:`, `chore:`). Explain any new runtime dependency in the commit body.

## Ground rules

- Numbers come only from the engine (`src/shared/engine`), never from the model.
- The engine stays pure: no `Date.now`, `Math.random`, `fetch` or browser globals (lint-enforced).
- No secrets, build output, coverage or screenshots in commits.
- Copy is plain, specific and in sentence case; errors say what happened and how to fix it.
