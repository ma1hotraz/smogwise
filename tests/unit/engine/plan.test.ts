import { describe, expect, it } from 'vitest';

import { applyChoices, commutes, recommendedChoices } from '../../../src/shared/engine/choices.js';
import {
  diurnalFactor,
  manualAir,
  seasonalAir,
  seasonalLevel,
} from '../../../src/shared/engine/fallbackAir.js';
import { buildPlan } from '../../../src/shared/engine/plan.js';
import type { Windows } from '../../../src/shared/engine/types.js';
import { SAMPLES } from '../../../src/shared/samples.js';
import { AirData } from '../../../src/shared/schema/air.js';
import { formatHour, hourOf, localHourKey, mean, round } from '../../../src/shared/time.js';
import { baseProfile, flatAir, NOW, sample, winterAir } from '../../helpers/fixtures.js';

describe('buildPlan', () => {
  it('builds a complete plan for every sample (AC1)', () => {
    for (const s of SAMPLES) {
      const plan = buildPlan(s.profile, winterAir(), NOW);
      expect(plan.routine.length).toBeGreaterThan(2);
      expect(plan.indoor.hacks.length).toBeGreaterThan(1);
      expect(plan.exposure.withPlan.totalUg).toBeLessThanOrEqual(plan.exposure.usual.totalUg);
      expect(plan.community.length).toBeGreaterThan(1);
    }
  });

  it('summarises the Sharma household on a very poor Delhi morning', () => {
    const plan = buildPlan(sample('sharma'), winterAir(), NOW);
    expect(plan.air).toMatchObject({
      pm25: 120,
      scale: 'NAQI',
      band: { label: 'Poor', level: 3 },
      trend: 'falling',
      grap: 'I',
      source: 'open-meteo',
    });
    expect(plan.tierGeneral).toBe(3);
    expect(plan.tierSensitive).toBe(4);
    expect(plan.sensitive).toEqual(['under5', 'over65', 'respiratory']);
    expect(plan.windows.clean?.startHour).toBe(13);
    expect(plan.choices).toMatchObject({
      n95: true,
      smartExercise: true,
      removeSources: ['incense', 'drySweeping'],
      kitchenExhaust: true,
    });
    expect(plan.exposure.reductionPct).toBeGreaterThan(20);
    expect(plan.alerts.map((a) => a.ruleId)).toEqual(['AL02']); // AL03 starts at tier 4
  });

  it('uses US AQI outside India and no GRAP', () => {
    const plan = buildPlan(sample('ayesha'), winterAir(), NOW);
    expect(plan.air.scale).toBe('US_AQI');
    expect(plan.air.grap).toBeNull();
    expect(plan.alerts[0]?.ruleId).toBe('AL01');
  });

  it('AC3: a sensitive household gets stricter advice at the same PM2.5', () => {
    const air = flatAir(45);
    const plain = baseProfile({ exercise: { kind: 'outdoor', hour: 15, minutes: 30 } });
    const sensitive = baseProfile(plain.lifestyle, { under5: 1 });
    const step = (p: typeof plain) =>
      buildPlan(p, air, NOW).routine.find((s) => s.ruleId === 'R03')?.title;
    expect(step(plain)).toBe('Keep outdoor exercise light and short');
    expect(step(sensitive)).toBe('Exercise indoors today');
  });

  it('user choices override defaults and change the dose (AC8)', () => {
    const profile = sample('sharma');
    const base = buildPlan(profile, winterAir(), NOW);
    const metro = buildPlan(profile, winterAir(), NOW, { mode: 'metro', purifierCadr: 450 });
    expect(metro.choices.mode).toBe('metro');
    expect(metro.exposure.withPlan.totalUg).toBeLessThan(base.exposure.withPlan.totalUg);
    const off = buildPlan(profile, winterAir(), NOW, {
      n95: false,
      removeSources: [],
      smartExercise: false,
      kitchenExhaust: false,
    });
    expect(off.exposure.withPlan.totalUg).toBe(off.exposure.usual.totalUg);
  });

  it('work-from-home days can remove the commute from the plan day', () => {
    const plan = buildPlan(sample('sharma'), winterAir(), NOW, { wfhDays: 6 });
    expect(plan.exposure.withPlan.byPlace.commute).toBe(0);
  });

  it('degrades safely with an empty series', () => {
    const empty = { ...flatAir(10), hourly: [] } as AirData;
    const plan = buildPlan(baseProfile(), empty, NOW);
    expect(plan.air.pm25).toBe(0);
    expect(plan.tierGeneral).toBe(0);
  });
});

describe('choices', () => {
  const windows: Windows = {
    clean: { startHour: 14, hours: 2, meanPm25: 40 },
    worst: null,
    meaningful: true,
  };
  const runner = baseProfile({ exercise: { kind: 'outdoor', hour: 6, minutes: 30 } }).lifestyle;

  it('recommends masks only for exposed modes on bad days', () => {
    expect(recommendedChoices(runner, 4).n95).toBe(false);
    const scooter = { ...runner, commute: { ...runner.commute, mode: 'two_wheeler' as const } };
    expect(recommendedChoices(scooter, 3).n95).toBe(true);
    expect(recommendedChoices(scooter, 2).n95).toBe(false);
  });

  it('smart exercise moves indoors, into the window, or leaves it alone', () => {
    const smart = { smartExercise: true };
    expect(applyChoices(runner, smart, 3, windows).exercise.kind).toBe('indoor');
    expect(applyChoices(runner, smart, 2, windows).exercise.hour).toBe(14);
    expect(applyChoices(runner, smart, 2, { ...windows, meaningful: false }).exercise.hour).toBe(6);
    expect(applyChoices(runner, smart, 1, windows).exercise).toEqual(runner.exercise);
    expect(applyChoices(runner, {}, 3, windows).exercise).toEqual(runner.exercise);
  });

  it('knows when a weekday includes the commute', () => {
    expect(commutes(runner)).toBe(true);
    expect(commutes(runner, 5)).toBe(false);
    expect(commutes({ ...runner, commute: { ...runner.commute, km: 0 } })).toBe(false);
  });
});

describe('fallback air', () => {
  const delhi = sample('sharma').location;

  it('builds 48 valid hours of a seasonal estimate from local midnight', () => {
    const air = seasonalAir(delhi, NOW);
    expect(AirData.safeParse(air).success).toBe(true);
    expect(air.hourly).toHaveLength(48);
    expect(air.hourly[0]?.time).toBe('2026-11-20T00:00');
    expect(air.hourly[24]?.time).toBe('2026-11-21T00:00');
    expect(round(mean(air.hourly.slice(0, 24).map((h) => h.pm25)))).toBe(171);
  });

  it('scales by city, country, default, month and hemisphere', () => {
    expect(seasonalLevel(delhi, 0)).toBe(180);
    expect(seasonalLevel({ ...delhi, name: 'Pune' }, 0)).toBe(120);
    expect(seasonalLevel({ ...delhi, name: 'Paris', countryCode: 'FR' }, 6)).toBeCloseTo(15.75);
    expect(seasonalLevel({ ...delhi, name: 'Santiago', countryCode: 'CL', lat: -33.4 }, 6)).toBe(
      35,
    );
  });

  it('anchors a manual reading at the current hour', () => {
    const air = manualAir(150, delhi, NOW);
    expect(air.source).toBe('manual');
    expect(air.hourly[10]?.pm25).toBe(150);
  });

  it('falls back to neutral factors for out-of-range months and hours', () => {
    expect(seasonalLevel(delhi, 99)).toBe(180);
    expect(diurnalFactor(Number.NaN)).toBeCloseTo(1.06, 2); // the shape mean
    expect(diurnalFactor(13)).toBe(0.62);
  });
});

describe('time helpers', () => {
  it('converts an instant to a local hour key, falling back to UTC for bad zones', () => {
    expect(localHourKey(NOW, 'Asia/Kolkata')).toBe('2026-11-20T10:00');
    expect(localHourKey(NOW, 'Not/AZone')).toBe('2026-11-20T05:00');
    expect(hourOf('2026-11-20T10:00')).toBe(10);
  });

  it('formats hours, means and rounding', () => {
    expect(formatHour(25)).toBe('01:00');
    expect(formatHour(-1)).toBe('23:00');
    expect(mean([])).toBe(0);
    expect(round(1.256, 2)).toBe(1.26);
  });
});
