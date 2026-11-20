import { describe, expect, it } from 'vitest';

import { bandFor, cigarettesFor, indexFor, scaleFor } from '../../../src/shared/engine/aqi.js';
import { householdTier, sensitiveGroups, tierFor } from '../../../src/shared/engine/risk.js';
import { baseProfile } from '../../helpers/fixtures.js';

describe('A01 index scale', () => {
  it('uses NAQI for India and US AQI elsewhere', () => {
    expect(scaleFor('IN')).toBe('NAQI');
    expect(scaleFor('PK')).toBe('US_AQI');
    expect(scaleFor('US')).toBe('US_AQI');
  });

  it.each([
    [0, 0],
    [9.0, 50],
    [9.1, 51],
    [35.4, 100],
    [35.5, 101],
    [55.4, 150],
    [55.5, 151],
    [125.4, 200],
    [125.5, 201],
    [225.4, 300],
    [225.5, 301],
    [325.4, 500],
    [600, 500],
  ])('US AQI %s µg/m³ → %s', (pm, index) => {
    expect(indexFor(pm, 'US_AQI')).toBe(index);
  });

  it('truncates US values to 0.1 µg/m³ and clamps negatives', () => {
    expect(indexFor(9.09, 'US_AQI')).toBe(50);
    expect(indexFor(-5, 'US_AQI')).toBe(0);
  });

  it.each([
    [30, 50],
    [31, 51],
    [60, 100],
    [61, 101],
    [90, 200],
    [91, 201],
    [120, 300],
    [121, 301],
    [250, 400],
    [251, 401],
    [380, 500],
    [500, 500],
  ])('NAQI %s µg/m³ → %s', (pm, index) => {
    expect(indexFor(pm, 'NAQI')).toBe(index);
  });

  it('AC2: 100 µg/m³ is "Poor" in India and "Unhealthy" on the US scale', () => {
    expect(bandFor(100, 'NAQI')).toEqual({ level: 3, label: 'Poor' });
    expect(bandFor(100, 'US_AQI')).toEqual({ level: 3, label: 'Unhealthy' });
  });

  it('labels every level and caps above the table', () => {
    expect(bandFor(5, 'US_AQI').label).toBe('Good');
    expect(bandFor(40, 'US_AQI').label).toBe('Unhealthy for Sensitive Groups');
    expect(bandFor(200, 'NAQI').label).toBe('Very Poor');
    expect(bandFor(900, 'NAQI')).toEqual({ level: 5, label: 'Severe' });
    expect(bandFor(900, 'US_AQI')).toEqual({ level: 5, label: 'Hazardous' });
  });
});

describe('A06 cigarettes', () => {
  it('22 µg/m³ for a day is one cigarette', () => {
    expect(cigarettesFor(22)).toBe(1);
    expect(cigarettesFor(129)).toBe(5.9);
  });
});

describe('A02/A03 risk', () => {
  it.each([
    [0, 0],
    [14.9, 0],
    [15, 1],
    [35.4, 1],
    [35.5, 2],
    [55.5, 3],
    [125.5, 4],
    [225.5, 5],
    [999, 5],
  ])('tier for %s µg/m³ is %s', (pm, tier) => {
    expect(tierFor(pm)).toBe(tier);
  });

  it('lists every sensitive group', () => {
    const groups = sensitiveGroups(
      baseProfile({}, { under5: 1, over65: 2, pregnant: true, respiratory: true, heart: true })
        .household,
    );
    expect(groups).toEqual(['under5', 'over65', 'pregnant', 'respiratory', 'heart']);
  });

  it('older children alone do not make a household sensitive', () => {
    expect(sensitiveGroups(baseProfile({}, { children: 3 }).household)).toEqual([]);
  });

  it('raises the tier by one for sensitive households, capped at 5', () => {
    expect(householdTier(2, true)).toBe(3);
    expect(householdTier(5, true)).toBe(5);
    expect(householdTier(2, false)).toBe(2);
  });
});
