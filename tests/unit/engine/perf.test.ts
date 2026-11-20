import { describe, expect, it } from 'vitest';

import { buildPlan } from '../../../src/shared/engine/plan.js';
import { NOW, sample, winterAir } from '../../helpers/fixtures.js';

describe('efficiency budget (docs/08)', () => {
  it('buildPlan averages under 2 ms', () => {
    const profile = sample('sharma');
    const air = winterAir();
    buildPlan(profile, air, NOW); // warm-up
    const runs = 1000;
    const started = performance.now();
    for (let i = 0; i < runs; i++) {
      buildPlan(profile, air, NOW, { mode: i % 2 === 0 ? 'metro' : 'bus' });
    }
    expect((performance.now() - started) / runs).toBeLessThan(2);
  });
});
