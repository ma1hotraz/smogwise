import { describe, expect, it } from 'vitest';

import { choicesFor, indoorHacks } from '../../../src/shared/engine/hacks.js';
import { heatingTradeOff, swapsFor } from '../../../src/shared/engine/swaps.js';
import type { Lifestyle } from '../../../src/shared/schema/profile.js';
import { baseProfile, sample } from '../../helpers/fixtures.js';

const flat = (v: number): number[] => Array.from({ length: 24 }, () => v);
const ids = (items: readonly { id: string }[]): string[] => items.map((i) => i.id);

describe('H indoor hacks', () => {
  it('ranks measurable hacks by reduction and ends with the two myth-busters', () => {
    const hacks = indoorHacks(sample('sharma').lifestyle, 150);
    const measurable = hacks.filter((h) => h.reductionPct !== null);
    expect(ids(hacks).slice(-2)).toEqual(['ionisers', 'plants']);
    expect(ids(measurable)).toEqual(
      expect.arrayContaining(['purifier', 'diy', 'incense', 'drySweeping', 'exhaust']),
    );
    // Indoor sources dominate this leaky home, so sealing alone would not help and is hidden.
    expect(ids(measurable)).not.toContain('seal');
    const values = measurable.map((h) => h.reductionPct ?? 0);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    // A 300 m³/h DIY box out-performs a purifier sized at the 216 m³/h minimum for 16 m².
    expect(ids(hacks).slice(0, 2)).toEqual(['diy', 'purifier']);
    expect(hacks[1]?.reductionPct).toBeGreaterThan(70);
  });

  it('offers capacity, not a DIY box, when the purifier is undersized; nothing when it is enough', () => {
    const rohit = sample('rohit').lifestyle;
    expect(ids(indoorHacks(rohit, 150))).not.toContain('purifier'); // 150 of 243 m³/h: adequate
    const l: Lifestyle = { ...rohit, home: { ...rohit.home, roomM2: 30 } };
    expect(ids(indoorHacks(l, 150))).toContain('purifier');
    expect(ids(indoorHacks(l, 150))).not.toContain('diy');
    expect(indoorHacks(l, 150)[0]?.title).toBe('Add purifier capacity');
    const chen = sample('chen').lifestyle;
    expect(ids(indoorHacks(chen, 60))).toEqual(['ionisers', 'plants']);
  });

  it('lists every indoor source the household has', () => {
    const l: Lifestyle = {
      ...baseProfile().lifestyle,
      sources: {
        smoking: true,
        incense: true,
        mosquitoCoil: true,
        candles: true,
        drySweeping: true,
      },
    };
    expect(ids(indoorHacks(l, 100))).toEqual(
      expect.arrayContaining(['smoking', 'incense', 'mosquitoCoil', 'candles', 'drySweeping']),
    );
  });

  it('never recommends a hack that would not help, such as sealing when outdoor air is clean', () => {
    const l: Lifestyle = { ...baseProfile().lifestyle, cooking: 'lpg' };
    expect(ids(indoorHacks(l, 150))).toContain('seal');
    expect(ids(indoorHacks(l, 0))).not.toContain('seal');
  });

  it('maps each hack to the what-if choice that models it', () => {
    expect(choicesFor({ kind: 'purifier', cadr: 300 })).toEqual({ purifierCadr: 300 });
    expect(choicesFor({ kind: 'sealGaps' })).toEqual({ sealGaps: true });
    expect(choicesFor({ kind: 'removeSource', source: 'candles' })).toEqual({
      removeSources: ['candles'],
    });
    expect(choicesFor({ kind: 'kitchenExhaust' })).toEqual({ kitchenExhaust: true });
  });
});

describe('S sustainable swaps', () => {
  const ctx = (lifestyle: Lifestyle, countryCode = 'IN') => ({
    lifestyle,
    ambient: flat(150),
    countryCode,
  });

  it('offers metro, bus and cycle to a 12 km scooter commuter, with weekly figures', () => {
    const swaps = swapsFor(ctx(sample('sharma').lifestyle));
    expect(ids(swaps)).toEqual(['mode-metro', 'mode-bus', 'wfh']);
    const metro = swaps[0]!;
    // 2 × 12 km × 6 days = 144 km; (0.035 − 0.012) × 144 = 3.3 kg; (0.02 − 0.0005) × 144 = 2.8 g
    expect(metro.co2KgWeek).toBe(3.3);
    expect(metro.pm25GWeek).toBe(2.8);
    expect(metro.doseDeltaPct).toBeLessThan(0);
    expect(metro.detail).toMatch(/if there is a route near you/);
  });

  it('flags the personal trade-off of cycling on smog days', () => {
    const l: Lifestyle = {
      ...baseProfile().lifestyle,
      commute: { mode: 'petrol_car', km: 5, daysPerWeek: 5, departHour: 9 },
    };
    const cycle = swapsFor(ctx(l)).find((s) => s.id === 'mode-cycle')!;
    expect(cycle.doseDeltaPct).toBeGreaterThan(0);
    expect(cycle.tradeOff).toMatch(/dose rises/);
    expect(cycle.co2KgWeek).toBe(7);
  });

  it('offers walking for short trips, and carpool and EV to drivers', () => {
    const l: Lifestyle = {
      ...baseProfile().lifestyle,
      commute: { mode: 'diesel_car', km: 2, daysPerWeek: 2, departHour: 9 },
    };
    expect(ids(swapsFor(ctx(l)))).toEqual([
      'mode-walk',
      'mode-cycle',
      'mode-metro',
      'mode-bus',
      'mode-ev',
      'carpool',
    ]);
    const ev: Lifestyle = { ...l, commute: { ...l.commute, mode: 'ev' } };
    expect(ids(swapsFor(ctx(ev)))).not.toContain('mode-ev');
  });

  it('offers metro to bus riders and nothing to walkers or home workers', () => {
    const bus: Lifestyle = {
      ...baseProfile().lifestyle,
      commute: { mode: 'bus', km: 10, daysPerWeek: 2, departHour: 9 },
    };
    expect(ids(swapsFor(ctx(bus)))).toEqual(['mode-metro']);
    const walk: Lifestyle = { ...bus, commute: { ...bus.commute, mode: 'walk', km: 1 } };
    expect(swapsFor(ctx(walk))).toEqual([]);
    expect(swapsFor(ctx(sample('chen').lifestyle))).toEqual([]);
  });

  it('shows the work-from-home dose change on a home day', () => {
    const wfh = swapsFor(ctx(sample('sharma').lifestyle)).find((s) => s.id === 'wfh')!;
    expect(wfh.choice).toEqual({ kind: 'wfhDays', days: 2 });
    expect(wfh.co2KgWeek).toBe(1.7);
  });

  it('cleaner cooking fuel: big PM2.5 cut, biogenic CO₂ not counted, Ujjwala only in India', () => {
    const l: Lifestyle = { ...baseProfile().lifestyle, cooking: 'biomass' };
    const india = swapsFor(ctx(l)).find((s) => s.id === 'cooking')!;
    expect(india).toMatchObject({ co2KgWeek: null, pm25GWeek: 167.9 });
    expect(india.doseDeltaPct).toBeLessThan(-30);
    expect(india.detail).toMatch(/Ujjwala/);
    expect(swapsFor(ctx(l, 'NP')).find((s) => s.id === 'cooking')!.detail).not.toMatch(/Ujjwala/);
  });

  it('electric heating: honest CO₂ trade-off for wood, a saving against charcoal', () => {
    const wood: Lifestyle = { ...baseProfile().lifestyle, heating: 'wood' };
    const fromWood = swapsFor(ctx(wood)).find((s) => s.id === 'heating')!;
    expect(fromWood.co2KgWeek).toBe(-22);
    expect(fromWood.tradeOff).toMatch(/22 kg more grid CO₂/);
    expect(fromWood.pm25GWeek).toBe(84);
    const brazier: Lifestyle = { ...wood, heating: 'brazier' };
    const fromBrazier = swapsFor(ctx(brazier)).find((s) => s.id === 'heating')!;
    expect(fromBrazier.co2KgWeek).toBe(-1);
    const kerosene: Lifestyle = { ...wood, heating: 'kerosene' };
    expect(swapsFor(ctx(kerosene)).find((s) => s.id === 'heating')!.co2KgWeek).toBe(-15);
  });

  it('states no trade-off when electric heating also saves CO₂', () => {
    expect(heatingTradeOff(4)).toBeNull();
    expect(heatingTradeOff(-3)).toMatch(/3 kg more/);
  });

  it('composting replaces burning', () => {
    const l: Lifestyle = { ...baseProfile().lifestyle, burnsWaste: true };
    expect(swapsFor(ctx(l)).find((s) => s.id === 'burning')).toMatchObject({
      pm25GWeek: 20,
      co2KgWeek: null,
    });
  });

  it('metro commuters with nothing else to change get only the work-from-home option', () => {
    expect(ids(swapsFor(ctx(baseProfile().lifestyle)))).toEqual(['wfh']);
    const noTrade: Lifestyle = { ...baseProfile().lifestyle, heating: 'electric' };
    expect(swapsFor(ctx(noTrade)).find((s) => s.id === 'heating')).toBeUndefined();
  });
});
