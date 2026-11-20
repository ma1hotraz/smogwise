# 06 — Accessibility (WCAG 2.2 AA)

## 1. Global requirements

| Requirement                             | Implementation                                                                                       | Verified by              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| Semantic structure                      | `header`/`nav`/`main`/`footer` landmarks, one `h1` per view, ordered headings                        | axe, component tests     |
| Skip link                               | First focusable element, jumps to `#main`                                                            | e2e                      |
| Keyboard                                | Everything operable by keyboard; no traps; logical order                                             | e2e keyboard-only flow   |
| Visible focus                           | 3 px outline with 2 px offset, ≥ 3:1 against adjacent colours (2.4.11/2.4.13)                        | contrast test            |
| Colour is never the only signal (1.4.1) | Bands show label + icon shape + number; chart bars have pattern for level ≥ 3                        | component tests          |
| Contrast (1.4.3, 1.4.11)                | Text ≥ 4.5:1, large text and UI ≥ 3:1, both themes                                                   | token contrast unit test |
| Reflow (1.4.10) and zoom                | Single column at 320 px, no horizontal scroll; rem units                                             | e2e at 320 px            |
| Text spacing (1.4.12)                   | No fixed heights on text containers                                                                  | e2e style injection      |
| Target size (2.5.8)                     | Interactive targets ≥ 24 × 24 px (44 px for primary buttons)                                         | e2e bounding-box check   |
| Motion (2.3.3)                          | Only small transitions; `prefers-reduced-motion` removes them                                        | CSS + e2e emulation      |
| Forced colours                          | `forced-colors` styles keep borders and focus                                                        | e2e emulation + axe      |
| Language (3.1.1, 3.1.2)                 | `<html lang="en">`; Hindi answers wrapped in `lang="hi"`                                             | component test           |
| Status messages (4.1.3)                 | Polite live region for "Plan ready", air loaded, dose changes; `role="alert"` for danger alerts only | component tests          |
| Errors (3.3.1, 3.3.3)                   | Inline errors linked with `aria-describedby`, `aria-invalid`; focus first error                      | component tests          |
| Consistent help (3.2.6)                 | "Ask Smogwise" in the same place on every view                                                       | e2e                      |
| Redundant entry (3.3.7)                 | Profile saved and pre-filled; samples avoid typing                                                   | e2e                      |
| Accessible authentication (3.3.8)       | No login                                                                                             | —                        |
| Dragging (2.5.7)                        | No drag interactions; slider has number input twin                                                   | component test           |

## 2. Components

- **Tabs** — WAI-ARIA tabs pattern: roving `tabindex`, ←/→/Home/End, `aria-controls`,
  `aria-selected`, panel `tabindex="0"`.
- **Combobox (city search)** — ARIA 1.2 combobox with listbox popup; `aria-expanded`,
  `aria-activedescendant`; ↑/↓/Enter/Escape; results count announced; debounce 300 ms.
- **Forecast chart** — SVG `role="img"` with a text summary in `aria-label` ("Cleanest 14:00–16:00
  at 88 µg/m³; worst 07:00–09:00 at 171"); "Show as table" toggles an equivalent `<table>` with
  caption and `scope` headers.
- **Dose meter** — native `<meter>` with visible text values; changes announced politely.
- **Toggles (what-if)** — native checkboxes styled as switches with visible labels and impact
  text in `aria-describedby`.
- **Household counters** — native `<input type="number">` with visible labels, clamped to range.
- **Alerts** — `danger` uses `role="alert"` once on first render; warnings are static sections.
- **Read aloud** — button hidden when `speechSynthesis` is missing; `aria-pressed` while speaking.

## 3. Inclusive design beyond WCAG

- Plain language (reading age ≈ 12), short sentences, times in the user's local format.
- Hindi answers in Ask Smogwise; read-aloud for low-literacy or low-vision users.
- Free and low-cost hacks are ranked before paid ones; the purifier is never the only answer.
- Sensitive members (children, elderly, pregnancy, asthma, heart) change the advice itself.
- Works offline and on slow 3G (≈ 40 kB of JS); no account needed.
- Light and dark themes follow the system and can be switched; text size control (100/115/130%).
