import { describe, expect, it } from 'vitest';

import { buildAlerts, listOf } from '../../../src/shared/engine/alerts.js';
import {
  communityActions,
  formatGrams,
  scaleImpact,
} from '../../../src/shared/engine/community.js';
import { fill } from '../../../src/shared/engine/data/copy.js';
import { homeState } from '../../../src/shared/engine/indoor.js';
import { buildRoutine, type RoutineContext } from '../../../src/shared/engine/routine.js';
import type { Swap, Tier, Windows } from '../../../src/shared/engine/types.js';
import type { Lifestyle } from '../../../src/shared/schema/profile.js';
import { baseProfile, sample, WINTER_DAY } from '../../helpers/fixtures.js';

const CLEAN: Windows = {
  clean: { startHour: 14, hours: 2, meanPm25: 87 },
  worst: { startHour: 6, hours: 2, meanPm25: 179 },
  meaningful: true,
};
const NONE: Windows = { clean: null, worst: null, meaningful: false };

function ctx(
  patch: Partial<RoutineContext> = {},
  lifestyle: Partial<Lifestyle> = {},
): RoutineContext {
  const profile = baseProfile(lifestyle);
  return {
    lifestyle: profile.lifestyle,
    household: profile.household,
    ambient: WINTER_DAY,
    tierGeneral: 3,
    tierSensitive: 3,
    sensitive: false,
    windows: CLEAN,
    home: homeState(profile.lifestyle),
    ...patch,
  };
}
const rules = (c: RoutineContext): string[] => buildRoutine(c).map((s) => `${s.ruleId}@${s.hour}`);
const titles = (c: RoutineContext): string[] => buildRoutine(c).map((s) => s.title);

describe('R routine', () => {
  it('orders steps by hour and keeps windows shut until the clean window (R01, R02)', () => {
    const steps = buildRoutine(ctx());
    expect(steps.map((s) => s.hour)).toEqual([...steps.map((s) => s.hour)].sort((a, b) => a - b));
    expect(steps[0]).toMatchObject({
      ruleId: 'R01',
      hour: 7,
      title: 'Keep windows shut until 14:00',
    });
    expect(steps[0]?.detail).toBe(
      'Morning air is about 171 µg/m³; it should ease to about 87 by then.',
    );
    expect(titles(ctx())).toContain('Air the home for 10 minutes');
  });

  it.each<[Tier, string]>([
    [0, 'Open windows and air the home'],
    [4, 'Air the home for 5 minutes'],
    [5, 'Keep windows shut all day'],
  ])('R02 at tier %s: %s', (tier, title) => {
    expect(titles(ctx({ tierGeneral: tier }))).toContain(title);
  });

  it('treats missing forecast hours as zero in the copy', () => {
    expect(buildRoutine(ctx({ ambient: [] }))[0]?.detail).toMatch(/about 0 µg/);
  });

  it('skips the airing step when no window remains today', () => {
    expect(rules(ctx({ windows: NONE }))).not.toContain('R02@14');
  });

  it('R03: indoors at tier ≥ 3, into the window at tier 2, as usual when clear', () => {
    const ex = { exercise: { kind: 'outdoor' as const, hour: 6, minutes: 30 } };
    expect(titles(ctx({}, ex))).toContain('Exercise indoors today');
    const moved = buildRoutine(ctx({ tierSensitive: 2 }, ex)).find((s) => s.ruleId === 'R03')!;
    expect(moved).toMatchObject({ hour: 14, title: 'Move your outdoor workout to 14:00' });
    expect(moved.impact).toBe('About 50% less PM2.5 per breath than at 06:00.');
    expect(
      buildRoutine(ctx({ tierSensitive: 2, sensitive: true }, ex)).find((s) => s.ruleId === 'R03')
        ?.detail,
    ).toMatch(/light/);
    expect(titles(ctx({ tierSensitive: 2, windows: NONE }, ex))).toContain(
      'Keep outdoor exercise light and short',
    );
    expect(titles(ctx({ tierSensitive: 1 }, ex))).toContain('Exercise outdoors as usual');
  });

  it('R03: indoor exercisers keep their routine; no step without exercise', () => {
    const indoor = { exercise: { kind: 'indoor' as const, hour: 18, minutes: 30 } };
    expect(buildRoutine(ctx({}, indoor)).find((s) => s.ruleId === 'R03')?.title).toBe(
      'Indoor workout as usual',
    );
    expect(rules(ctx())).not.toContain('R03@7');
    expect(
      rules(ctx({}, { exercise: { kind: 'outdoor', hour: 7, minutes: 0 } })).some((r) =>
        r.startsWith('R03'),
      ),
    ).toBe(false);
  });

  it('R04: masks or metro for exposed modes, recirculation in cars, nothing for metro', () => {
    const scooter = {
      commute: { mode: 'two_wheeler' as const, km: 10, daysPerWeek: 5, departHour: 9 },
    };
    expect(titles(ctx({}, scooter))).toContain('Wear a well-fitted N95 on your commute');
    expect(titles(ctx({ tierGeneral: 4, tierSensitive: 4 }, scooter))).toContain(
      'Take the metro if you can; otherwise wear an N95',
    );
    expect(titles(ctx({ tierSensitive: 2 }, scooter))).toContain(
      'Commute as usual, on quieter streets',
    );
    const car = { commute: { mode: 'cng_car' as const, km: 10, daysPerWeek: 5, departHour: 9 } };
    expect(titles(ctx({}, car))).toContain('Windows up, air on recirculate');
    expect(rules(ctx()).some((r) => r.startsWith('R04'))).toBe(false);
  });

  it('R05/R09: children play indoors on bad days, in the window otherwise; elders walk indoors', () => {
    const family = baseProfile({}, { children: 1, over65: 1 }).household;
    expect(titles(ctx({ household: family }))).toEqual(
      expect.arrayContaining([
        'Indoor play this afternoon',
        'Indoor walk instead of the evening walk',
      ]),
    );
    expect(rules(ctx({ household: family, tierSensitive: 2 }))).toContain('R05@14');
    expect(rules(ctx({ household: family, tierSensitive: 2, windows: NONE }))).toContain('R05@16');
  });

  it('R06/R07/R08: cooking, heating safety and the night', () => {
    expect(titles(ctx({}, { cooking: 'biomass' }))).toContain(
      'Cook with the door open and children out of the kitchen',
    );
    expect(titles(ctx({}, { cooking: 'lpg' }))).toContain('Exhaust on and lids on while cooking');
    expect(rules(ctx()).some((r) => r.startsWith('R06'))).toBe(false);
    expect(titles(ctx({}, { heating: 'brazier' }))).toContain('Heat safely tonight');
    expect(titles(ctx())).toContain('Shut the bedroom door before sleep');
    expect(
      titles(ctx({}, { home: { tightness: 'average', roomM2: 15, purifierCadr: 200 } })),
    ).toContain('Purifier on high in the bedroom');
  });
});

describe('AL alerts', () => {
  const base = {
    lifestyle: baseProfile().lifestyle,
    household: baseProfile().household,
    sensitive: [],
    tierGeneral: 2 as Tier,
    tierSensitive: 2 as Tier,
    source: 'open-meteo' as const,
  };

  it('AC6: unsafe heaters always raise the carbon-monoxide alert, first', () => {
    for (const heating of ['brazier', 'wood', 'kerosene'] as const) {
      const alerts = buildAlerts({
        ...base,
        tierGeneral: 0,
        tierSensitive: 0,
        lifestyle: { ...base.lifestyle, heating },
      });
      expect(alerts[0]?.ruleId).toBe('AL01');
    }
    expect(buildAlerts(base)).toEqual([]);
  });

  it('raises health alerts by tier and household', () => {
    const household = { ...base.household, respiratory: true, pregnant: true, under5: 1 };
    const alerts = buildAlerts({
      ...base,
      household,
      sensitive: ['under5', 'pregnant', 'respiratory'],
      tierGeneral: 5,
      tierSensitive: 5,
    });
    expect(alerts.map((a) => a.ruleId)).toEqual(['AL04', 'AL02', 'AL03', 'AL05']);
    expect(alerts[1]?.detail).toBe(
      'With a child under 5, a pregnancy and asthma or COPD at home, limit time outdoors and avoid effort outside.',
    );
  });

  it('labels estimated data', () => {
    expect(buildAlerts({ ...base, source: 'seasonal-fallback' })[0]?.detail).toMatch(
      /typical winter pattern/,
    );
    expect(buildAlerts({ ...base, source: 'manual' })[0]?.detail).toMatch(/value you entered/);
  });

  it('joins lists naturally', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('fills templates and leaves unknown placeholders', () => {
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(fill('plain')).toBe('plain');
  });
});

describe('C community', () => {
  it('picks actions by context', () => {
    const rohit = sample('rohit');
    const ids = communityActions({
      lifestyle: rohit.lifestyle,
      household: rohit.household,
      tierGeneral: 4,
      countryCode: 'IN',
    }).map((a) => a.id);
    expect(ids).toEqual(['carpool', 'compost', 'report', 'clean-room', 'school', 'neighbours']);
    const quiet = baseProfile();
    const few = communityActions({
      lifestyle: quiet.lifestyle,
      household: quiet.household,
      tierGeneral: 1,
      countryCode: 'FR',
    });
    expect(few.map((a) => a.id)).toEqual(['compost', 'report']);
    expect(few[1]?.detail).toMatch(/municipal/);
  });

  it('scales savings, ignores trade-offs and converts to tree-years', () => {
    const swaps = [
      { co2KgWeek: 3, pm25GWeek: 2 },
      { co2KgWeek: null, pm25GWeek: 20 },
      { co2KgWeek: -22, pm25GWeek: 84 },
    ] as Swap[];
    expect(scaleImpact(swaps, 100)).toEqual({
      co2KgMonth: 1305,
      pm25GMonth: 46110,
      treeYears: 746,
    });
    expect(scaleImpact([], 10)).toEqual({ co2KgMonth: 0, pm25GMonth: 0, treeYears: 0 });
  });

  it('formats grams', () => {
    expect(formatGrams(820)).toBe('820 g');
    expect(formatGrams(3400)).toBe('3.4 kg');
  });
});
