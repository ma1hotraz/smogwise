# 01 — Product Spec

## 1. Problem

Every winter, cities across North India, Pakistan, Nepal, Bangladesh, China, Mongolia, the
Balkans and parts of Latin America sit under temperature inversions that trap traffic exhaust,
crop and waste burning smoke, coal and wood heating and construction dust. In Delhi, PM2.5
routinely exceeds 120 µg/m³ for weeks — eight times the WHO 24-hour guideline (15 µg/m³).

Families already know "the air is bad". What they lack is **specific, local, actionable**
guidance:

- _When_ today is the air least bad for a walk, a run, the school run or airing the flat?
- _What_ in my own home is making it worse (incense, a mosquito coil, a coal brazier, frying
  with no exhaust), and what single fix helps most?
- Is a purifier worth it for _my_ room, and is mine big enough?
- If I take the metro instead of my scooter, what does that change — for my lungs and for the
  city's air?
- What can our housing society or school do together?

Generic AQI apps show a number and a colour. Generic chatbots give generic tips with no link
to today's forecast or to the household. **Smogwise closes that gap.**

## 2. Users and personas

| Persona (sample profile on the front page) | Context                                                                                                           | What they need                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **The Sharma household, Delhi**            | Toddler (3), grandmother with asthma, two working parents; scooter commute 12 km; LPG; no purifier; incense daily | Safe windows for the child, asthma precautions, a purifier verdict, commute swap |
| **Ayesha, Lahore**                         | Cycles 6 km to university; runs in the early morning; shared flat; wood-fired heater                              | Exercise timing, heater safety (carbon monoxide), mask guidance                  |
| **Chen family, Beijing**                   | Remote work, one child, older sealed apartment with a purifier (CADR 400 m³/h)                                    | Is my purifier enough? when to ventilate, school-day routine                     |
| **Rohit, RWA volunteer, Gurugram**         | Wants to cut leaf and waste burning and start carpools in a 120-flat society                                      | Community actions with numbers, a printable notice                               |

Primary users are **families** (multi-generational, with sensitive members) and **community
organisers** (resident welfare associations, schools, workplaces).

## 3. Brief → feature map (Problem Statement Alignment)

| Phrase in the brief                                     | Feature                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| "GenAI-powered assistant"                               | **Ask Smogwise** (Gemini) answers questions about _today's plan_; **Daily brief** narrated by Gemini           |
| "help families and communities"                         | Household profile with sensitive members; **Community** tab with scaled impact and a printable notice          |
| "navigate severe winter smog and urban air pollution"   | Live 48-hour PM2.5 forecast, local index (India NAQI or US AQI), GRAP stage for Delhi NCR, safety alerts       |
| "suggest low-emission daily routines"                   | **Today** tab: an hour-by-hour routine (exercise, airing, commute, cooking, sleep) built from the forecast     |
| "indoor air quality hacks"                              | **Home air** tab: ranked fixes with modelled indoor PM2.5 reduction, purifier sizing, DIY filter, myth-busters |
| "sustainable alternatives"                              | **Swaps** tab: commute, cooking, heating and waste alternatives with CO₂ and PM2.5 per week                    |
| "tailored to their location"                            | City search or rounded geolocation → forecast, local index scale, clean-air windows in local time              |
| "and lifestyle"                                         | Commute mode/distance/days, exercise habit, cooking fuel, heating, home type, purifier, indoor sources         |
| "clearly explaining the direct impact of their choices" | Every card shows _Impact_ numbers + _Why_ (rule id); the **What-if** toggles recompute inhaled dose live       |

## 4. Features

### F1 — Intake ("Tell Smogwise about your home")

- **Location:** city search (accessible combobox, server-side geocoding) or "Use my location"
  (browser geolocation, rounded to 0.1° ≈ 11 km _in the browser_ before it is sent anywhere).
- **Household:** adults; children under 5; children 5–17; adults 65+; pregnancy; asthma/COPD;
  heart condition.
- **Lifestyle:** commute mode (walk, cycle, two-wheeler, auto-rickshaw, bus, metro, petrol car,
  diesel car, CNG car, EV, work from home), one-way distance (km), commute days per week, usual
  departure time; exercise (none / outdoor / indoor) and usual time; cooking fuel (LPG/PNG,
  induction, biomass/kerosene); heating (none, electric, coal/charcoal brazier, wood, kerosene);
  home (leaky / average / sealed), main room area (m²), purifier (none / yes + CADR);
  indoor sources (smoking, incense, mosquito coils, candles, dry sweeping); burns waste or leaves.
- Four **sample profiles** load a complete plan in one click (judges see everything immediately).
- Profile saved to `localStorage` only, zod-validated on load; "Forget my data" clears it.

### F2 — Today (low-emission daily routine)

- **Air now:** PM2.5, local index value and band label (text + icon, never colour alone), trend,
  data source and time, cigarette-equivalent of breathing today's air.
- **Forecast strip:** 24/48-hour PM2.5 bars (SVG) with an equivalent data table for screen readers.
- **Clean-air window:** the cleanest 2-hour block of waking hours, and the worst block to avoid.
- **Routine timeline:** time-slotted actions for the day (airing burst, exercise, commute,
  cooking, purifier, sleep), each with a reason and the rule id.
- **Safety alerts:** carbon-monoxide risk from braziers, red-flag symptoms, sensitive-group
  warnings. Alerts are announced politely; emergencies use `role="alert"`.
- **Daily brief:** 2–3 sentences from Gemini that explain the day; a deterministic template if
  AI is unavailable. "Listen" reads it aloud (Web Speech API, feature-detected).

### F3 — Home air (indoor hacks)

- Mass-balance model of indoor PM2.5 for this home (air-exchange rate, room volume, purifier
  CADR, indoor sources).
- Ranked fixes with modelled reduction (%), cost tier (free / low / medium) and effort.
- Purifier verdict: required CADR for 5 air changes per hour vs. the user's purifier.
- DIY fan + filter box guidance; "clean room" strategy; honest myth-busters (houseplants, "anti-
  pollution" incense, ionisers that emit ozone).

### F4 — Swaps & impact (sustainable alternatives)

- Alternatives that fit the user's distance and context (walk ≤ 2 km, cycle ≤ 8 km, metro/bus,
  carpool, EV, work-from-home days; LPG/induction instead of biomass; electric heating instead of
  coal/wood; composting instead of burning).
- For each: **kg CO₂/week**, **g PM2.5 emitted/week**, **change in your own inhaled dose**, trade-offs
  stated honestly (e.g., an electric heater may emit more CO₂ on a coal-heavy grid but removes
  indoor smoke and carbon-monoxide risk).
- **What-if toggles:** accept a swap or a hack and the "Your day" dose meter recomputes instantly.

### F5 — Community

- Choose a scale (1–1,000 households) and see monthly CO₂ and PM2.5 avoided by the chosen swaps.
- Community actions: carpool board, no-burning pledge + compost pit, report burning (official
  channels per country), shared clean-air room for elderly residents, school outdoor-play policy
  by index band, checking on vulnerable neighbours.
- **Printable notice** for a society noticeboard (print stylesheet, no extra libraries).

### F6 — Ask Smogwise (GenAI assistant)

- Free-form questions about _today's_ plan ("Can my mother go for her evening walk?").
- Grounded on the engine output; answers cite rule ids; 3 follow-up suggestions.
- Language: English or Hindi answers.
- Red-flag symptom questions get an immediate deterministic safety answer without calling AI.
- Works without a key: an intent-matched, engine-backed answer.

## 5. Key flows

1. **First visit → sample profile → Today** (≤ 1 click; plan renders instantly from the local
   engine; air data and brief stream in after).
2. **First visit → own profile:** location → household → lifestyle → "Build my day" → Today.
3. **Explore impact:** Swaps → toggle "Take the metro" → dose meter and weekly CO₂ update and are
   announced to screen readers.
4. **Ask:** type a question → answer with cited rules → follow-up chips.
5. **Community:** set 120 households → copy/print notice.
6. **Offline / API down:** a seasonal fallback profile for the chosen city or manual PM2.5
   entry; the source label says so.

## 6. Acceptance criteria

| ID   | Criterion                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | A sample profile renders a complete Today view in one click; the plan itself needs no API call (it is computed in the browser)                                         |
| AC2  | PM2.5 of 100 µg/m³ shows "Poor" (India NAQI) for an Indian city and "Unhealthy" (US AQI) elsewhere                                                                     |
| AC3  | A household with a child under 5 or an asthma patient gets stricter activity advice at the same PM2.5                                                                  |
| AC4  | The clean-air window is the lowest-mean 2-hour waking block of the supplied forecast (unit- and property-tested)                                                       |
| AC5  | Adding a purifier, an N95 mask or removing an indoor source never increases the modelled dose (property-tested); a hack is only shown when it lowers this home's PM2.5 |
| AC6  | A coal/charcoal brazier or wood heater always produces a carbon-monoxide safety alert                                                                                  |
| AC7  | Every recommendation shows at least one impact figure and a rule id; every figure has a documented source                                                              |
| AC8  | Toggling a swap recomputes the dose meter within one frame and announces the change                                                                                    |
| AC9  | Ask Smogwise answers without an API key; red-flag symptoms always return the emergency answer                                                                          |
| AC10 | No exact coordinates, names or free-text profile data leave the browser except the question the user types                                                             |
| AC11 | All screens: zero axe violations, keyboard-only operable, usable at 320 px and 200% zoom                                                                               |

## 7. Out of scope (stated assumptions)

- Smogwise is **not medical advice**. It never recommends medication or dosages; it tells users to
  follow their clinician's plan and when to seek care.
- Emission factors and infiltration ratios are **published averages**; results are estimates
  for comparison, labelled as such.
- Forecasts are model output (CAMS via Open-Meteo), not ground monitors; the source is shown.
- No accounts, no server-side storage, no tracking.
