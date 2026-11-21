# 03 — Decision Engine

The engine is a set of pure functions in `src/shared/engine/`. Input: `Profile`, `AirData`,
`Choices` (what-if toggles) and `now` (injected). Output: `Plan`. No I/O, no `Date.now()`, no
randomness — enforced by lint. Every recommendation carries a **rule id** shown in the UI, and
every constant lives in `engine/data/` with its source.

> All figures are estimates for comparing choices, built from published averages. The UI labels
> them as estimates and links to this page's sources in the README.

---

## A — Air and risk

### A01 Index scale and band

Scale by country: `IN` → **India NAQI** (CPCB); every other country → **US AQI (EPA, 2024
revision)**. Sub-index by linear interpolation inside the breakpoint row.

| Level | US AQI label                   | PM2.5 µg/m³ (US) | Index   | NAQI label   | PM2.5 µg/m³ (NAQI) | Index   |
| ----- | ------------------------------ | ---------------- | ------- | ------------ | ------------------ | ------- |
| 0     | Good                           | 0.0–9.0          | 0–50    | Good         | 0–30               | 0–50    |
| 1     | Moderate                       | 9.1–35.4         | 51–100  | Satisfactory | 31–60              | 51–100  |
| 2     | Unhealthy for Sensitive Groups | 35.5–55.4        | 101–150 | Moderate     | 61–90              | 101–200 |
| 3     | Unhealthy                      | 55.5–125.4       | 151–200 | Poor         | 91–120             | 201–300 |
| 4     | Very Unhealthy                 | 125.5–225.4      | 201–300 | Very Poor    | 121–250            | 301–400 |
| 5     | Hazardous                      | 225.5–325.4      | 301–500 | Severe       | 251–380            | 401–500 |

Values above the top row cap at 500. US values are truncated to 0.1 µg/m³, NAQI to integers.
Sources: US EPA, _Final Reconsideration of the PM NAAQS_ (Feb 2024) Technical Assistance
Document; CPCB, _National Air Quality Index_ (2014).

### A02 Sensitive groups

A household is _sensitive_ if it has any of: child under 5, adult 65+, pregnancy, asthma/COPD,
heart condition. Children 5–17 are listed as a group but do not raise the tier on their own.
Source: WHO Global Air Quality Guidelines (2021); EPA AirNow sensitive-group guidance.

### A03 Personal tier (health-based, independent of the display scale)

| Tier | Name           | PM2.5 µg/m³ | Basis                      |
| ---- | -------------- | ----------- | -------------------------- |
| 0    | Clear          | < 15        | WHO 2021 24-hour guideline |
| 1    | Fair           | 15–35.4     | US AQI Moderate            |
| 2    | Caution        | 35.5–55.4   | US AQI USG                 |
| 3    | Unhealthy      | 55.5–125.4  | US AQI Unhealthy           |
| 4    | Very unhealthy | 125.5–225.4 | US AQI Very Unhealthy      |
| 5    | Emergency      | ≥ 225.5     | US AQI Hazardous           |

`tierGeneral = tier(pm25Now)`; `tierSensitive = min(5, tierGeneral + 1)` when the household is
sensitive, else equal to `tierGeneral`. Activity advice uses `tierSensitive` for the household.

### A04 Clean-air and worst windows

Candidates: 2-hour blocks that start at or after the current hour, within the next 24 hours,
inside waking hours (start 06:00–19:00 local, so the block ends by 21:00).
`clean` = lowest mean PM2.5 (ties → earliest); `worst` = highest mean (ties → earliest).
`meaningful = worst.mean − clean.mean ≥ max(10, 0.2 × worst.mean)`; when false the UI says
"no meaningfully cleaner time today" instead of implying a benefit that is not there.
Rationale: winter inversions make early morning and late evening the most polluted hours; the
afternoon mixing layer is usually cleanest — the forecast decides, not an assumption.

### A05 Trend

Mean of the next 6 hours vs. now: > +10% rising, < −10% falling, otherwise steady.

### A06 Cigarette equivalence

`cigarettes = effectiveConcentration / 22`, where 22 µg/m³ of PM2.5 for 24 hours ≈ one cigarette
(Berkeley Earth, Muller & Muller 2015). Effective concentration = inhaled dose ÷ volume breathed.

## L — Location

| Rule | Condition                                          | Effect                                                                                                                                                     |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L01  | Country code                                       | Index scale (A01) and number formatting                                                                                                                    |
| L02  | Within 60 km of central Delhi (28.61° N, 77.21° E) | Indicative **GRAP** stage from the NAQI value: I 201–300, II 301–400, III 401–450, IV > 450 (CAQM, 2024)                                                   |
| L03  | Country code IN / PK / CN / other                  | Where to report open burning: CPCB _Sameer_ app & state boards (Delhi: _Green Delhi_ app) / Punjab EPA (Lahore) / 12369 hotline (MEE) / municipal helpline |

## I — Indoor model (mass balance)

Steady-state indoor PM2.5 for the main room (Chen & Zhao 2011, _Atmos. Environ._ review):

```
C_in = (P · a · C_out + E / V) / (a + k + CADR_eff / V)
```

| Symbol   | Meaning                                 | Value                                                           |
| -------- | --------------------------------------- | --------------------------------------------------------------- |
| P        | penetration factor                      | 0.8                                                             |
| a        | air exchange rate (h⁻¹), windows closed | leaky 1.0 · average 0.5 · sealed 0.3                            |
| k        | deposition rate (h⁻¹)                   | 0.2                                                             |
| V        | room volume (m³)                        | floor area × 2.7 m                                              |
| CADR_eff | effective clean-air delivery            | rated CADR × 0.8 (field derating for placement and filter load) |
| E        | indoor source emission (µg/h)           | `Δref × 40 m³ × (0.5 + 0.2)` — see table                        |

Indoor source strengths are expressed as **Δref**: the daily-average PM2.5 they add in a 40 m³
reference room with average tightness and no purifier. Converting to an emission rate means a
purifier also reduces source smoke, as it does in reality.

| Source                               | Δref µg/m³ | Basis                                                          |
| ------------------------------------ | ---------- | -------------------------------------------------------------- |
| Smoking indoors                      | 40         | Semple et al. 2015 (smoking homes median ≈ 31 µg/m³); US EPA   |
| Incense daily                        | 25         | Lee & Wang 2004; See & Balasubramanian 2011                    |
| Mosquito coil overnight              | 50         | Liu et al. 2003 (one coil ≈ 75–137 cigarettes of PM2.5)        |
| Candles                              | 5          | Wallace et al. 2019                                            |
| Dry sweeping                         | 5          | Resuspension studies; conservative                             |
| Cooking: biomass / kerosene          | 150        | Balakrishnan et al. 2013 (Indian solid-fuel homes, 24-h means) |
| Cooking: LPG/PNG, no exhaust         | 10         | Conservative                                                   |
| Cooking: LPG with exhaust, induction | 3          | Conservative                                                   |
| Heating: coal/charcoal brazier       | 50         | Conservative; **plus carbon-monoxide alert**                   |
| Heating: wood indoors                | 60         | Conservative                                                   |
| Heating: kerosene heater             | 30         | Conservative                                                   |

### H — Indoor hacks (ranked by modelled reduction of daily-average home PM2.5)

| Rule | Hack                                                          | Shown when                 | Modelled change              | Cost   |
| ---- | ------------------------------------------------------------- | -------------------------- | ---------------------------- | ------ |
| H01  | Run a purifier sized for the room (CADR ≥ 5 × V m³/h)         | No purifier, or undersized | CADR → required              | Medium |
| H02  | DIY fan + filter box                                          | No purifier                | CADR 300 m³/h (conservative) | Low    |
| H03  | Seal gaps, close unused vents, keep windows shut on bad hours | Leaky or average home      | `a → max(0.3, 0.6 a)`        | Low    |
| H04  | Smoke outside, never indoors                                  | Smoking                    | remove source                | Free   |
| H05  | Swap incense for unlit alternatives                           | Incense                    | remove source                | Free   |
| H06  | Bed net or plug-in repellent instead of coils                 | Mosquito coil              | remove source                | Low    |
| H07  | Wet-mop instead of dry sweeping                               | Dry sweeping               | remove source                | Free   |
| H08  | LED lights instead of candles                                 | Candles                    | remove source                | Free   |
| H09  | Exhaust/chimney on, lids on pots when cooking                 | LPG/PNG                    | 10 → 3                       | Free   |
| H10  | Avoid ionisers and "ozone" purifiers                          | Always (myth-buster)       | Avoids ozone; no number      | —      |
| H11  | Houseplants do not clean room air measurably                  | Always (myth-buster)       | Cummings & Waring 2019       | —      |

Only hacks with a **positive** modelled reduction are shown: sealing a home, for example, traps
indoor smoke and _raises_ PM2.5 when outdoor air is cleaner than indoor air (found by the
property suite, docs/07).

**Purifier verdict:** `required = 5 × V` m³/h (≈ AHAM "2/3 rule", 4.8 air changes per hour).
`coverage = CADR / required`: none · undersized (< 0.6) · adequate (0.6–1.0) · good (≥ 1.0).

## E — Exposure (inhaled dose)

`dose (µg) = Σ concentration(place, hour) × breathing rate × hours`, over a typical day split
into: sleep (23:00–07:00, home), commute (two legs: depart hour, depart + 9 h), work or school
(8 h, 0.6 × ambient), exercise (minutes at the usual hour) and the rest at home.

| Activity / place      | Breathing rate m³/h | Concentration                         |
| --------------------- | ------------------- | ------------------------------------- |
| Sleep                 | 0.3                 | home model                            |
| At home, awake        | 0.45                | home model                            |
| Work / school indoors | 0.45                | 0.6 × ambient                         |
| Exercise              | 2.5                 | outdoor: ambient; indoor: home model  |
| Commute               | see mode table      | mode ratio × ambient (× 0.3 with N95) |

Breathing rates: US EPA _Exposure Factors Handbook_ (2011), ch. 6, adult means rounded.
N95 factor 0.3 = 70 % real-world reduction (conservative vs. 95 % lab filtration; fit leakage).

### Commute modes

| Mode           | Speed km/h | Rate m³/h | Ratio to ambient | CO₂ kg / pkm | PM2.5 g / pkm |
| -------------- | ---------- | --------- | ---------------- | ------------ | ------------- |
| Walk           | 5          | 1.3       | 1.3              | 0            | 0             |
| Cycle          | 14         | 1.8       | 1.3              | 0            | 0             |
| Two-wheeler    | 25         | 0.6       | 1.5              | 0.035        | 0.020         |
| Auto-rickshaw  | 20         | 0.5       | 1.5              | 0.055        | 0.010         |
| Bus            | 15         | 0.5       | 1.2              | 0.020        | 0.002         |
| Metro          | 30         | 0.6       | 0.7              | 0.012        | 0.0005        |
| Petrol car     | 22         | 0.45      | 0.7              | 0.140        | 0.012         |
| Diesel car     | 22         | 0.45      | 0.7              | 0.150        | 0.020         |
| CNG car        | 22         | 0.45      | 0.7              | 0.110        | 0.010         |
| EV             | 22         | 0.45      | 0.7              | 0.090        | 0.008         |
| Work from home | —          | —         | —                | 0            | 0             |

Sources: India GHG Program, _India Specific Road Transport Emission Factors_ (2015); CEA CO₂
Baseline Database v19 (grid 0.71 kg/kWh) × 0.13 kWh/km for EV; EMEP/EEA Guidebook 2023 for
exhaust + non-exhaust PM2.5; in-vehicle ratios from Goel et al. 2015 (Delhi) and de Nazelle et
al. 2017 (commuter exposure review). Ratios and factors are rounded to two significant figures.

## R — Routine (time-slotted)

| Rule | Condition                                                                              | Step (hour)                                                                |
| ---- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R01  | tierGeneral ≥ 2 and early hours worse than the clean window                            | 07:00 Keep windows shut until the clean window                             |
| R02  | tierGeneral ≤ 1                                                                        | Air the home freely                                                        |
|      | tierGeneral 2–4                                                                        | Clean window: 10-minute airing burst (5 min, purifier on, when tier 4)     |
|      | tierGeneral 5                                                                          | Keep windows shut; air only the kitchen with the exhaust on                |
| R03  | Exercise outdoor and tierSensitive ≤ 1                                                 | Exercise at the usual hour                                                 |
|      | tierSensitive 2                                                                        | Move to the clean window; lighter intensity if sensitive                   |
|      | tierSensitive ≥ 3                                                                      | Indoors at the usual hour (impact: dose saved vs. outdoors)                |
| R04  | Commute in an exposed mode (walk, cycle, two-wheeler, auto, bus) and tierSensitive ≥ 3 | Depart hour: wear a well-fitted N95; tier ≥ 4: take the metro if available |
|      | Exposed mode and tierSensitive < 3                                                     | Commute as usual, on quieter streets                                       |
|      | Car                                                                                    | Recirculation on, windows up                                               |
| R05  | Children and tierSensitive ≥ 3                                                         | 16:00 Indoor play; no outdoor sport                                        |
| R06  | Every day                                                                              | Cooking hour (08:00 and 19:00): exhaust on, lids on; biomass → see S07     |
| R07  | Heating is brazier / wood / kerosene                                                   | 20:00 Safe heating (see AL01)                                              |
| R08  | Purifier                                                                               | 22:00 Purifier on high, bedroom door shut, 30 min before sleep             |
|      | No purifier                                                                            | 22:00 Shut the bedroom door; damp-dust surfaces                            |
| R09  | Adult 65+ and tierSensitive ≥ 3                                                        | 17:00 Indoor walk instead of the evening walk                              |

## S — Sustainable swaps

Weekly commute distance = `2 × km × daysPerWeek`. For each feasible alternative:
`co2KgWeek = (EF_now − EF_alt) × weeklyKm`, `pm25GWeek` likewise, `doseDeltaPct` = change in
total commute-day dose. Positive numbers are savings; a dose increase is shown as a trade-off.

| Rule | Alternative                                      | Feasible when                             |
| ---- | ------------------------------------------------ | ----------------------------------------- |
| S01  | Walk                                             | km ≤ 2                                    |
| S02  | Cycle                                            | km ≤ 8 (trade-off note if the dose rises) |
| S03  | Metro / bus                                      | Mode is not already metro/bus/walk/cycle  |
| S04  | Carpool (2 people)                               | Car                                       |
| S05  | EV (long-term)                                   | Petrol / diesel / CNG car                 |
| S06  | Work from home 2 days/week                       | Commute days ≥ 3, mode ≠ WFH              |
| S07  | LPG/PNG or induction instead of biomass/kerosene | Cooking = biomass                         |
| S08  | Electric heating + draught-proofing              | Heating = brazier / wood / kerosene       |
| S09  | Compost instead of burning                       | Burns waste or leaves                     |

Household fuel figures (per week, 3 h of heating per evening, 2 kg of garden/household waste):

| Fuel                          | CO₂ kg/week         | PM2.5 g/week | Basis                                           |
| ----------------------------- | ------------------- | ------------ | ----------------------------------------------- |
| Charcoal brazier 1 kg/evening | 21                  | 14           | 3.0 kg CO₂/kg; ~2 g PM2.5/kg                    |
| Wood 1.5 kg/evening           | 0 (biogenic, noted) | 84           | ~8 g PM2.5/kg (EEA residential wood)            |
| Kerosene 0.4 L/evening        | 7                   | 1            | 2.5 kg CO₂/L                                    |
| Electric 1.5 kW               | 22                  | 0 (local)    | CEA grid 0.71 kg/kWh — trade-off shown honestly |
| Biomass cooking 3 kg/day      | 0 (biogenic)        | 168          | ~8 g PM2.5/kg                                   |
| LPG cooking                   | 7                   | 0.1          | ~0.3 kg LPG/day × 3.0 kg CO₂/kg                 |
| Burning 2 kg waste            | — (noted)           | 20           | 9.8 g PM2.5/kg (Wiedinmyer et al. 2014)         |

## C — Community

| Rule | Logic                                                                                                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01  | Monthly impact = selected swaps' weekly savings × households (1–1,000) × 4.35                                                                                                                                                    |
| C02  | Equivalence: CO₂ ÷ 21 kg ≈ tree-years of uptake (widely cited average; labelled approximate)                                                                                                                                     |
| C03  | Actions chosen by context: carpool board (car commuters), no-burning pledge + compost pit, report burning (L03), clean-air room for elderly (tier ≥ 3), school play policy (children), check on vulnerable neighbours (tier ≥ 4) |

## AL — Safety alerts

| Rule | Condition                                       | Level   | Message (summary)                                                                  |
| ---- | ----------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| AL01 | Heating = brazier, wood or kerosene             | danger  | Carbon monoxide: never sleep with it burning in a closed room; ventilate; CO alarm |
| AL02 | Sensitive household and tierSensitive ≥ 3       | warning | Who is at risk and what to limit                                                   |
| AL03 | (Asthma/COPD, heart or 65+) and tierGeneral ≥ 4 | warning | Follow your clinician's plan; red-flag symptoms that need urgent care              |
| AL04 | tierGeneral = 5                                 | danger  | Everyone indoors; avoid all exertion                                               |
| AL05 | Pregnancy and tierGeneral ≥ 3                   | warning | Limit outdoor time; mask when out                                                  |
| AL06 | Air source is fallback or manual                | info    | Figures use a seasonal estimate / your value                                       |

## Choices (what-if) and the default plan

`buildPlan(profile, air, now, choices?)`. Without explicit choices the engine applies its own
recommendations (N95 per R04, exercise per R03, remove indoor sources per H04–H08, kitchen exhaust per H09 when cooking on gas, purifier
unchanged). The _Your usual day_ dose uses the profile as-is; _Smogwise day_ uses the choices. The
user toggles any swap or hack; the plan recomputes synchronously (< 2 ms).
