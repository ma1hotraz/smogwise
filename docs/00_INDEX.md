# Smogwise — Doc Pack Index

> **Smogwise** (smog + wise) — a GenAI-powered clean-air companion that helps families and
> communities get through severe winter smog. It reads the live air forecast for _your_ location,
> combines it with _your_ household and lifestyle, and produces a low-emission daily routine,
> indoor air hacks and sustainable swaps — each with a number that shows the direct impact of
> the choice.

**Challenge:** [Challenge 6] Urban Air Quality Assistant

---

## Doc map — every document serves a scored parameter

| #   | File                    | Defines                                                    | Parameter served                      |
| --- | ----------------------- | ---------------------------------------------------------- | ------------------------------------- |
| 01  | `01_PRODUCT_SPEC.md`    | Problem, personas, features, flows, acceptance criteria    | Problem Statement Alignment           |
| 02  | `02_ARCHITECTURE.md`    | Stack, folders, data models, API contracts, decisions      | Code Quality, Efficiency              |
| 03  | `03_DECISION_ENGINE.md` | Deterministic rules, formulas, constants and their sources | Alignment ("logical decision making") |
| 04  | `04_AI_INTEGRATION.md`  | Gemini prompts, schemas, guardrails, fallbacks             | Alignment, Security                   |
| 05  | `05_SECURITY.md`        | Threat model and mandatory controls                        | Security                              |
| 06  | `06_ACCESSIBILITY.md`   | WCAG 2.2 AA requirements per component                     | Accessibility                         |
| 07  | `07_TESTING.md`         | Test pyramid, required cases, coverage gates               | Testing                               |
| 08  | `08_EFFICIENCY.md`      | Budgets, caching, payload and runtime limits               | Efficiency                            |
| 09  | `09_CODE_QUALITY.md`    | Conventions, lint rules, size limits, CI, review checklist | Code Quality                          |
| 10  | `10_BUILD_PLAN.md`      | Ordered phases, verification gates, submission checklist   | All                                   |

---

## Core design principle

**Rules for numbers, AI for words.** Every number the user sees — air-quality band, clean-air
window, inhaled dose, kg of CO₂, grams of PM2.5 — comes from a pure, tested decision engine with
named rules and cited constants. Gemini explains the plan in plain language, answers questions
about it and adapts tone and language. It never invents a number. If the model is down or no key
is set, the app still works end to end with deterministic answers.
