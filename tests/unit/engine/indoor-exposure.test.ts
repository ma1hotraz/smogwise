import { describe, expect, it } from 'vitest';

import { doseFor, schedule } from '../../../src/shared/engine/exposure.js';
import {
  homeState,
  indoorPm,
  indoorRatio,
  purifierVerdict,
} from '../../../src/shared/engine/indoor.js';
import { percentChange, reductionPct } from '../../../src/shared/math.js';
import { baseProfile } from '../../helpers/fixtures.js';

const flat = (v: number): number[] => Array.from({ length: 24 }, () => v);

describe('indoor mass balance', () => {
  it('a source adds exactly its Δref in the 40 m³ reference room', () => {
    // 40 m³ ≈ 14.81 m² × 2.7 m; average tightness; induction (3) + incense (25)
    const l = baseProfile({
      home: { tightness: 'average', roomM2: 40 / 2.7, purifierCadr: 0 },
      sources: {
        smoking: false,
        incense: true,
        mosquitoCoil: false,
        candles: false,
        drySweeping: false,
      },
    }).lifestyle;
    expect(indoorPm(0, homeState(l))).toBeCloseTo(28, 6);
  });

  it('leaky homes let more smog in than sealed ones', () => {
    const ratio = (tightness: 'leaky' | 'average' | 'sealed'): number =>
      indoorRatio(
        homeState(baseProfile({ home: { tightness, roomM2: 15, purifierCadr: 0 } }).lifestyle),
      );
    expect(ratio('leaky')).toBeCloseTo(0.667, 3);
    expect(ratio('average')).toBeCloseTo(0.571, 3);
    expect(ratio('sealed')).toBeCloseTo(0.48, 3);
  });

  it('applies choices: purifier, sealing, removed sources, exhaust, fuels', () => {
    const l = baseProfile({
      cooking: 'lpg',
      heating: 'kerosene',
      home: { tightness: 'leaky', roomM2: 15, purifierCadr: 0 },
      sources: {
        smoking: true,
        incense: false,
        mosquitoCoil: false,
        candles: false,
        drySweeping: false,
      },
    }).lifestyle;
    expect(homeState(l).sourceDelta).toBe(40 + 10 + 30);
    const changed = homeState(l, {
      purifierCadr: 300,
      sealGaps: true,
      removeSources: ['smoking'],
      kitchenExhaust: true,
      heating: 'electric',
    });
    expect(changed).toMatchObject({ ach: 0.6, cadr: 300, sourceDelta: 3 });
    expect(homeState(l, { cooking: 'induction' }).sourceDelta).toBe(40 + 3 + 30);
  });

  it('sealing never takes a home below 0.3 air changes, and does nothing to sealed homes', () => {
    const sealed = baseProfile({
      home: { tightness: 'sealed', roomM2: 15, purifierCadr: 0 },
    }).lifestyle;
    expect(homeState(sealed, { sealGaps: true }).ach).toBe(0.3);
    const average = baseProfile().lifestyle;
    expect(homeState(average, { sealGaps: true }).ach).toBe(0.3);
  });

  it.each([
    [0, 'none', 0],
    [100, 'undersized', 0.49],
    [150, 'adequate', 0.74],
    [203, 'good', 1],
  ])('purifier verdict for CADR %s in 15 m²', (cadr, status, coverage) => {
    expect(purifierVerdict(15, cadr)).toEqual({ status, requiredCadr: 203, coverage });
  });
});

describe('E exposure', () => {
  it('matches a hand-computed home day to 1 µg', () => {
    const l = baseProfile({
      commute: { mode: 'wfh', km: 0, daysPerWeek: 0, departHour: 9 },
    }).lifestyle;
    const dose = doseFor({
      ambient: flat(100),
      lifestyle: l,
      home: homeState(l),
      n95: false,
      commuting: true,
    });
    // C_in = (0.8·0.5·100 + 3·28/40.5) / 0.7 = 60.106; volume = 8·0.3 + 16·0.45 = 9.6 m³
    expect(dose.totalUg).toBe(577);
    expect(dose.volumeM3).toBe(9.6);
    expect(dose.cigarettes).toBe(2.7);
    expect(dose.byPlace).toMatchObject({ commute: 0, work: 0, exercise: 0 });
  });

  it('books commute, work, exercise and sleep minutes that add up to a day', () => {
    const l = baseProfile({
      commute: { mode: 'two_wheeler', km: 25, daysPerWeek: 5, departHour: 23 },
      exercise: { kind: 'outdoor', hour: 6, minutes: 90 },
    }).lifestyle;
    const plan = schedule(l, true);
    const total = (place: keyof (typeof plan)[number]['minutes']): number =>
      plan.reduce((sum, slot) => sum + slot.minutes[place], 0);
    expect(total('commute')).toBe(120);
    expect(total('work')).toBe(480);
    expect(total('exercise')).toBe(90);
    expect(
      plan.every((slot) => Object.values(slot.minutes).reduce((a, b) => a + b, 0) === 60),
    ).toBe(true);
  });

  it('caps a commute leg at three hours and skips the commute on home days', () => {
    const l = baseProfile({
      commute: { mode: 'walk', km: 80, daysPerWeek: 5, departHour: 8 },
    }).lifestyle;
    expect(schedule(l, true).reduce((s, slot) => s + slot.minutes.commute, 0)).toBe(360);
    expect(schedule(l, false).reduce((s, slot) => s + slot.minutes.commute, 0)).toBe(0);
  });

  it('an N95 cuts exposed commute dose by 70% but does nothing in a car', () => {
    const exposed = baseProfile({
      commute: { mode: 'auto', km: 10, daysPerWeek: 5, departHour: 9 },
    }).lifestyle;
    const input = {
      ambient: flat(150),
      lifestyle: exposed,
      home: homeState(exposed),
      commuting: true,
    };
    const without = doseFor({ ...input, n95: false }).byPlace.commute;
    const withMask = doseFor({ ...input, n95: true }).byPlace.commute;
    expect(withMask / without).toBeCloseTo(0.3, 1);
    const car = baseProfile({
      commute: { mode: 'ev', km: 10, daysPerWeek: 5, departHour: 9 },
    }).lifestyle;
    const carInput = { ambient: flat(150), lifestyle: car, home: homeState(car), commuting: true };
    expect(doseFor({ ...carInput, n95: true }).totalUg).toBe(
      doseFor({ ...carInput, n95: false }).totalUg,
    );
  });

  it('indoor exercise breathes home air; outdoor breathes ambient', () => {
    const outdoor = baseProfile({ exercise: { kind: 'outdoor', hour: 18, minutes: 60 } }).lifestyle;
    const indoor = { ...outdoor, exercise: { ...outdoor.exercise, kind: 'indoor' as const } };
    const run = (l: typeof outdoor): number =>
      doseFor({
        ambient: flat(200),
        lifestyle: l,
        home: homeState(l),
        n95: false,
        commuting: false,
      }).byPlace.exercise;
    expect(run(outdoor)).toBe(500);
    expect(run(indoor)).toBeLessThan(run(outdoor));
  });

  it('treats a missing hour as clean air', () => {
    const l = baseProfile({
      commute: { mode: 'wfh', km: 0, daysPerWeek: 0, departHour: 9 },
    }).lifestyle;
    const dose = doseFor({
      ambient: [],
      lifestyle: l,
      home: homeState(l),
      n95: false,
      commuting: false,
    });
    expect(dose.totalUg).toBeGreaterThan(0);
  });

  it('computes signed percentage change', () => {
    expect(percentChange(200, 150)).toBe(-25);
    expect(percentChange(0, 10)).toBe(0);
    expect(reductionPct(200, 150)).toBe(25);
    expect(reductionPct(0, 10)).toBe(0);
  });
});
