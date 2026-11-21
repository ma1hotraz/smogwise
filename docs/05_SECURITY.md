# 05 — Security

## 1. Assets and threats (STRIDE-lite)

| Asset / surface     | Threat                                        | Control                                                                                                                |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Gemini API key      | Leak via client bundle, logs or repo          | Server env only; bundle scan in CI; gitleaks; key never logged; `.env*` git-ignored                                    |
| AI routes (cost)    | Abuse / denial of wallet                      | Per-IP 10/min + 200/day, global 120/min, cache + in-flight de-dup, token caps, timeouts                                |
| Model output        | Prompt injection, harmful or invented content | Sanitise, delimit, schema output, zod, number check, id whitelist, text-only rendering                                 |
| Upstream fetch      | SSRF, slow/huge responses, poisoned data      | Fixed hosts (no user-supplied URL), `URLSearchParams`, 5 s timeout, 512 kB cap, zod validation                         |
| HTTP inputs         | Injection, oversized bodies, type confusion   | strict zod schemas (unknown keys rejected) on every query and body, 16 kB JSON limit, 415 for non-JSON, numeric bounds |
| Browser             | XSS, clickjacking, mixed content              | Strict CSP (no inline script/style), no `dangerouslySetInnerHTML`, frame-ancestors none, HSTS                          |
| Cross-site requests | CSRF-style misuse of AI routes                | Same-origin guard on POST (Origin / Sec-Fetch-Site), JSON content type required                                        |
| User privacy        | Location and health data exposure             | 0.1° rounding in the browser, profile only in localStorage, no cookies, no analytics, no server storage                |
| Errors              | Information disclosure                        | Generic `{ error: code }`; stack traces only in logs; request id for correlation                                       |
| Dependencies        | Known vulnerabilities, supply chain           | `npm audit --omit=dev --audit-level=high` in CI, Dependabot, lockfile, minimal runtime deps                            |
| Supply chain (CI)   | Tampered actions or tools                     | Actions pinned to commit SHAs; gitleaks verified by sha256 before it runs                                              |
| Container           | Privilege escalation                          | Multi-stage, non-root user, `apk` removed from the runtime image                                                       |

## 2. Mandatory controls (each has a test)

- **Headers** (helmet + custom): CSP `default-src 'self'; script-src 'self'; style-src 'self';
img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none';
frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`; HSTS 1 year;
  `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`;
  `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()`; COOP/CORP
  same-origin; `X-Frame-Options: DENY`; `x-powered-by` removed. Same headers in `vercel.json`.
- **Validation:** every route parses with strict zod schemas (unknown keys rejected), as do stored
  profiles, model output and the client's view of server replies; Open-Meteo responses are
  validated for the fields used, tolerating extra fields from the third party; lat/lon finite and bounded;
  `q` Unicode letters/marks/spaces and `.,'-()` only.
- **Rate limiting:** proven by a test that receives 429.
- **Upstream hardening:** proven by tests for timeout, oversized body, invalid JSON, schema
  mismatch, non-200 → 502 with a generic body.
- **AI hardening:** tests for injection strings ("ignore previous instructions…"), invented
  numbers, unknown rule ids, invalid JSON, model timeout, red-flag routing.
- **Secrets:** `.env.example` only; CI greps `dist/client` for `AIza` and `GEMINI_API_KEY`.
- **Client storage:** profile parsed with zod on load; invalid data discarded, never executed.
- **Lint:** `react/no-danger`, `no-eval`, `no-implied-eval`, `@typescript-eslint/no-unsafe-*`.

## 3. OWASP Top 10 for LLM applications (2025) mapping

| Risk                                   | Mitigation in Smogwise                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| LLM01 Prompt injection                 | Delimited question, system rules, schema output, number + id checks, text render |
| LLM02 Sensitive information disclosure | Context has no coordinates/PII; system prompt holds no secrets                   |
| LLM03 Supply chain                     | Official `@google/genai`, lockfile, audit                                        |
| LLM04 Data and model poisoning         | No training or retrieval from user data                                          |
| LLM05 Improper output handling         | zod validation, text-only rendering, fallback on any failure                     |
| LLM06 Excessive agency                 | Model has no tools and cannot change the plan                                    |
| LLM07 System prompt leakage            | Prompt contains no secrets; leakage is harmless                                  |
| LLM08 Vector/embedding weaknesses      | Not applicable (no RAG)                                                          |
| LLM09 Misinformation                   | Numbers only from the engine; medical guardrails; red-flag deterministic path    |
| LLM10 Unbounded consumption            | Rate limits, token caps, timeouts, caching, body limits                          |

## 4. Responsible AI and health safety

- Visible "Not medical advice" note on Today and Ask; emergency guidance is deterministic.
- Advice for sensitive groups errs on the cautious side (tier + 1).
- Estimates are labelled as estimates; sources are listed in the README.
- Inclusive defaults: Hindi answers, read-aloud, low-cost hacks before paid ones.
