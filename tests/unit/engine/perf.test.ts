import { describe, expect, it } from 'vitest';

import { buildPlan } from '../../../src/shared/engine/plan.js';
import { NOW, sample, winterAir } from '../../helpers/fixtures.js';

const RUNS = 1000;
const BUDGET_MS = 2;

describe('efficiency budget (docs/08)', () => {
  it('buildPlan takes under 2 ms (median of 1,000 runs, robust to a busy machine)', () => {
    const profile = sample('sharma');
    const air = winterAir();
    buildPlan(profile, air, NOW); // warm-up
    const times = Array.from({ length: RUNS }, (_, i) => {
      const started = performance.now();
      buildPlan(profile, air, NOW, { mode: i % 2 === 0 ? 'metro' : 'bus' });
      return performance.now() - started;
    }).sort((a, b) => a - b);
    expect(times[Math.floor(RUNS / 2)]).toBeLessThan(BUDGET_MS);
  });
});
