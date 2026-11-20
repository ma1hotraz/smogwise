import { describe, expect, it } from 'vitest';

import { distanceKm, grapStage, reportingChannel } from '../../../src/shared/engine/location.js';
import {
  currentIndex,
  dayProfile,
  findWindows,
  trendFrom,
} from '../../../src/shared/engine/series.js';
import { airFrom, winterAir } from '../../helpers/fixtures.js';

describe('series helpers', () => {
  const air = winterAir();

  it('finds the hour containing now, or the first hour when now is earlier', () => {
    expect(currentIndex(air.hourly, '2026-11-20T10:00')).toBe(10);
    expect(currentIndex(air.hourly, '2026-11-19T10:00')).toBe(0);
    expect(currentIndex(air.hourly, '2026-12-01T10:00')).toBe(47);
  });

  it("returns today's 24 hours and fills gaps with the current value", () => {
    expect(dayProfile(air.hourly, '2026-11-20T10:00')).toHaveLength(24);
    const partial = airFrom([50, 60, 70], { date: '2026-11-20' });
    const day = dayProfile(partial.hourly, '2026-11-20T01:00');
    expect(day.slice(0, 3)).toEqual([50, 60, 70]);
    expect(day[10]).toBe(60);
    expect(dayProfile([], '2026-11-20T01:00')[0]).toBe(0);
  });
});

describe('A04 windows', () => {
  it('picks the cleanest and worst waking 2-hour blocks from now', () => {
    const { clean, worst, meaningful } = findWindows(winterAir().hourly, 10);
    expect(clean).toEqual({ startHour: 13, hours: 2, meanPm25: 87 });
    expect(worst?.startHour).toBe(6);
    expect(meaningful).toBe(true);
  });

  it('ignores past hours and night hours', () => {
    const pastIsCleanest = Array.from({ length: 20 }, (_, h) => (h === 8 || h === 9 ? 10 : 100));
    expect(findWindows(airFrom(pastIsCleanest).hourly, 12).clean?.startHour).toBe(12);
    // From 15:00 the 24-hour lookahead reaches tomorrow's cleaner afternoon.
    expect(findWindows(winterAir().hourly, 15).clean?.startHour).toBe(13);
    const night = airFrom(
      Array.from({ length: 6 }, () => 10),
      { date: '2026-11-20' },
    );
    expect(findWindows(night.hourly, 0)).toEqual({ clean: null, worst: null, meaningful: false });
  });

  it('breaks ties by the earliest block and flags a flat day as not meaningful', () => {
    const flat = airFrom(Array.from({ length: 48 }, () => 100));
    const { clean, worst, meaningful } = findWindows(flat.hourly, 0);
    expect(clean?.startHour).toBe(6);
    expect(worst?.startHour).toBe(6);
    expect(meaningful).toBe(false);
  });

  it('needs a gap of at least 10 µg/m³ and 20% of the worst block', () => {
    const values = Array.from({ length: 48 }, (_, i) =>
      i % 24 === 14 || i % 24 === 15 ? 92 : 100,
    );
    expect(findWindows(airFrom(values).hourly, 0).meaningful).toBe(false);
    const low = Array.from({ length: 48 }, (_, i) => (i % 24 === 14 || i % 24 === 15 ? 30 : 45));
    expect(findWindows(airFrom(low).hourly, 0).meaningful).toBe(true);
  });
});

describe('A05 trend', () => {
  it('reports rising, falling and steady', () => {
    expect(trendFrom(airFrom([100, 120, 120, 120]).hourly, 0)).toBe('rising');
    expect(trendFrom(airFrom([100, 80, 80]).hourly, 0)).toBe('falling');
    expect(trendFrom(airFrom([100, 105, 95]).hourly, 0)).toBe('steady');
  });

  it('is steady at the end of the series or with no reading', () => {
    expect(trendFrom(airFrom([100]).hourly, 0)).toBe('steady');
    expect(trendFrom([], 0)).toBe('steady');
  });
});

describe('L02/L03 location', () => {
  it('measures great-circle distance', () => {
    expect(Math.round(distanceKm(28.61, 77.21, 28.46, 77.03))).toBe(24);
  });

  it.each([
    [200, null],
    [201, 'I'],
    [301, 'II'],
    [401, 'III'],
    [451, 'IV'],
  ])('GRAP for NAQI %s in Delhi is %s', (naqi, stage) => {
    expect(grapStage('IN', 28.7, 77.2, naqi)).toBe(stage);
  });

  it('applies GRAP only inside Delhi NCR', () => {
    expect(grapStage('IN', 19.1, 72.9, 450)).toBeNull();
    expect(grapStage('PK', 28.7, 77.2, 450)).toBeNull();
  });

  it('names the right reporting channel', () => {
    expect(reportingChannel('IN')).toMatch(/Sameer/);
    expect(reportingChannel('PK')).toMatch(/Punjab EPA/);
    expect(reportingChannel('CN')).toMatch(/12369/);
    expect(reportingChannel('FR')).toMatch(/municipal/);
  });
});
