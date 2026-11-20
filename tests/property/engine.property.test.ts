/** Engine invariants (docs/07 §2), 500 runs each. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { indexFor } from '../../src/shared/engine/aqi.js';
import { doseFor } from '../../src/shared/engine/exposure.js';
import { homeState } from '../../src/shared/engine/indoor.js';
import { buildPlan } from '../../src/shared/engine/plan.js';
import { findWindows } from '../../src/shared/engine/series.js';
import {
  COMMUTE_MODES,
  COOKING_FUELS,
  HEATING_TYPES,
  INDOOR_SOURCES,
  Profile,
  TIGHTNESS,
} from '../../src/shared/schema/profile.js';
import { airFrom, NOW } from '../helpers/fixtures.js';

const RUNS = { numRuns: 500 };
const pm = fc.double({ min: 0, max: 1000, noNaN: true });
const day = fc.array(fc.integer({ min: 0, max: 600 }), { minLength: 24, maxLength: 24 });

const lifestyle = fc.record({
  commute: fc.record({
    mode: fc.constantFrom(...COMMUTE_MODES),
    km: fc.integer({ min: 0, max: 80 }),
    daysPerWeek: fc.integer({ min: 0, max: 7 }),
    departHour: fc.integer({ min: 0, max: 23 }),
  }),
  exercise: fc.record({
    kind: fc.constantFrom('none', 'outdoor', 'indoor'),
    hour: fc.integer({ min: 0, max: 23 }),
    minutes: fc.integer({ min: 0, max: 180 }),
  }),
  cooking: fc.constantFrom(...COOKING_FUELS),
  heating: fc.constantFrom(...HEATING_TYPES),
  home: fc.record({
    tightness: fc.constantFrom(...TIGHTNESS),
    roomM2: fc.integer({ min: 6, max: 100 }),
    purifierCadr: fc.integer({ min: 0, max: 2000 }),
  }),
  sources: fc.record(
    Object.fromEntries(INDOOR_SOURCES.map((s) => [s, fc.boolean()])) as Record<
      (typeof INDOOR_SOURCES)[number],
      fc.Arbitrary<boolean>
    >,
  ),
  burnsWaste: fc.boolean(),
});

const household = fc.record({
  adults: fc.integer({ min: 0, max: 12 }),
  under5: fc.integer({ min: 0, max: 8 }),
  children: fc.integer({ min: 0, max: 10 }),
  over65: fc.integer({ min: 0, max: 8 }),
  pregnant: fc.boolean(),
  respiratory: fc.boolean(),
  heart: fc.boolean(),
});

const profile = fc
  .record({ lifestyle, household, countryCode: fc.constantFrom('IN', 'PK', 'CN', 'US') })
  .map(({ lifestyle: l, household: h, countryCode }) =>
    Profile.parse({
      version: 1,
      location: { name: 'Town', countryCode, lat: 28.7, lon: 77.2, timezone: 'Asia/Kolkata' },
      household: h,
      lifestyle: l,
    }),
  );

describe('engine properties', () => {
  it('index is monotonic and within 0–500 on both scales', () => {
    fc.assert(
      fc.property(pm, pm, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        for (const scale of ['NAQI', 'US_AQI'] as const) {
          expect(indexFor(lo, scale)).toBeLessThanOrEqual(indexFor(hi, scale));
          expect(indexFor(hi, scale)).toBeGreaterThanOrEqual(0);
          expect(indexFor(hi, scale)).toBeLessThanOrEqual(500);
        }
      }),
      RUNS,
    );
  });

  it('AC5: a purifier, an N95 or removing indoor sources never increases dose', () => {
    fc.assert(
      fc.property(profile, day, fc.integer({ min: 1, max: 1500 }), (p, ambient, cadr) => {
        const l = p.lifestyle;
        const dose = (choices: Parameters<typeof homeState>[1], n95 = false): number =>
          doseFor({ ambient, lifestyle: l, home: homeState(l, choices), n95, commuting: true })
            .totalUg;
        const base = dose({});
        expect(dose({ purifierCadr: l.home.purifierCadr + cadr })).toBeLessThanOrEqual(base);
        expect(dose({}, true)).toBeLessThanOrEqual(base);
        expect(dose({ removeSources: [...INDOOR_SOURCES] })).toBeLessThanOrEqual(base);
      }),
      RUNS,
    );
  });

  it('AC4: the clean window mean is ≤ every candidate block', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 48, maxLength: 48 }),
        fc.integer({ min: 0, max: 23 }),
        (values, start) => {
          const air = airFrom(values);
          const { clean } = findWindows(air.hourly, start);
          for (let i = start; i < start + 23; i++) {
            const hour = i % 24;
            if (clean && hour >= 6 && hour <= 19) {
              expect(clean.meanPm25).toBeLessThanOrEqual(
                ((values[i] ?? 0) + (values[i + 1] ?? 0)) / 2,
              );
            }
          }
        },
      ),
      RUNS,
    );
  });

  it('buildPlan never throws and every figure is finite', () => {
    fc.assert(
      fc.property(
        profile,
        fc.array(fc.integer({ min: 0, max: 900 }), { minLength: 1, maxLength: 48 }),
        (p, values) => {
          const plan = buildPlan(p, airFrom(values), NOW);
          expect(Number.isFinite(plan.exposure.usual.totalUg)).toBe(true);
          expect(Number.isFinite(plan.exposure.withPlan.cigarettes)).toBe(true);
          expect(Number.isFinite(plan.indoor.homePm25)).toBe(true);
          expect(
            plan.swaps.every(
              (s) => Number.isFinite(s.pm25GWeek) && Number.isFinite(s.doseDeltaPct),
            ),
          ).toBe(true);
        },
      ),
      RUNS,
    );
  });
});
