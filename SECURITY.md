# Security

## Reporting a vulnerability

Please open a private security advisory on the repository (Security → Advisories) rather than a
public issue. We aim to reply within three working days.

## What Smogwise protects

| Asset                              | Why it matters                        |
| ---------------------------------- | ------------------------------------- |
| Gemini API key                     | Cost and abuse                        |
| AI routes                          | Denial of wallet, prompt injection    |
| Users' location and household data | Privacy, including health information |
| The browser session                | XSS, clickjacking                     |

## Controls (each one is covered by a test)

| Area             | Control                                                                                                                                                                                      | Where                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Secrets          | Key read only on the server; `.env*` git-ignored; build fails if the client bundle mentions the key; gitleaks in CI; logs redact credential-like fields                                      | `src/server/config.ts`, `scripts/check-bundle.mjs`, `logger.ts` |
| Headers          | CSP `default-src 'self'` with no inline script/style, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP, `X-Frame-Options: DENY`, no `x-powered-by`; identical in `vercel.json` | `src/server/middleware/security.ts`, `vercel.json`              |
| Input validation | zod `.strict()` on every query and body; 16 kB JSON limit; 415 for non-JSON; place names limited to letters and `.,'-()`; coordinates bounded                                                | `src/shared/schema/`, `src/server/routes.ts`                    |
| Cross-site use   | POSTs refused when `Origin`/`Sec-Fetch-Site` show another site (403)                                                                                                                         | `src/server/middleware/origin.ts`                               |
| Abuse            | Per-IP limits: 120/min API, 60/min data, 10/min + 200/day AI; caches with in-flight de-duplication; token caps; timeouts                                                                     | `security.ts`, `cache.ts`, `ai/service.ts`                      |
| Upstream (SSRF)  | Fixed hosts, parameters via `URLSearchParams`, `redirect: 'error'`, 5 s timeout, 512 kB cap, response schema validation, generic 502 on failure                                              | `src/server/upstream/openMeteo.ts`                              |
| Errors           | Generic `{ error: code }` bodies with a request id; error names only in logs, never stack traces or messages                                                                                 | `src/server/middleware/errors.ts`                               |
| Client           | No `dangerouslySetInnerHTML` (lint rule); model text rendered as text; stored profile re-validated on every load                                                                             | `eslint.config.js`, `src/client/lib/storage.ts`                 |
| Supply chain     | Lockfile, `npm audit --omit=dev --audit-level=high` in CI, Dependabot, six runtime dependencies                                                                                              | `.github/`                                                      |
| Container        | Multi-stage build, non-root user, no package manager in the runtime image                                                                                                                    | `Dockerfile`                                                    |

## Prompt-injection and LLM safety (OWASP Top 10 for LLM applications, 2025)

| Risk                                   | Mitigation                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM01 Prompt injection                 | Question sanitised (control, zero-width and bidi characters removed; delimiters neutralised), placed in a delimited block that the system prompt marks as data |
| LLM02 Sensitive information disclosure | The model sees a plan summary only: no coordinates, names or exact household composition                                                                       |
| LLM05 Improper output handling         | Structured JSON output, zod validation, cited rule ids filtered to known ids, text-only rendering                                                              |
| LLM06 Excessive agency                 | The model has no tools and cannot change the plan                                                                                                              |
| LLM07 System prompt leakage            | The prompt contains no secrets                                                                                                                                 |
| LLM09 Misinformation                   | Every number must appear in the plan context, otherwise the rule-based answer is used; red-flag symptoms never reach the model                                 |
| LLM10 Unbounded consumption            | Rate limits, token caps, timeouts, caching, body limits                                                                                                        |

## Privacy

- "Use my location" rounds coordinates to 0.1° (about 11 km) **in the browser** before use.
- The profile lives only in `localStorage`; "Forget my data" removes everything Smogwise stored.
- No accounts, cookies, analytics or server-side storage. Server logs hold route, status and
  timing only — never questions, answers or profiles.

The full threat model is in [`docs/05_SECURITY.md`](docs/05_SECURITY.md).
