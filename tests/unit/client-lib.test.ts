// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { askSmogwise, fetchAir, requestBrief, searchPlaces } from '../../src/client/lib/api.js';
import { countryFromTimezone, placeLabel } from '../../src/client/lib/geo.js';
import {
  formatInt,
  modeLabel,
  savingText,
  scaleName,
  tierName,
} from '../../src/client/lib/labels.js';
import { canSpeak } from '../../src/client/lib/speech.js';
import {
  forgetEverything,
  loadCachedAir,
  loadPrefs,
  loadProfile,
  saveCachedAir,
  saveProfile,
} from '../../src/client/lib/storage.js';
import { hackIsOn, swapIsOn, toggleHack, toggleSwap } from '../../src/client/lib/whatIf.js';
import { liveAir, stubApi } from '../helpers/browser.js';
import { sharmaContext } from '../helpers/fakes.js';
import { sample } from '../helpers/fixtures.js';

describe('storage', () => {
  it('round-trips a valid profile and discards tampered data', () => {
    saveProfile(sample('sharma'));
    expect(loadProfile()?.location.name).toBe('Delhi');
    localStorage.setItem(
      'smogwise.profile.v1',
      JSON.stringify({ version: 1, location: { name: '<script>' } }),
    );
    expect(loadProfile()).toBeNull();
    localStorage.setItem('smogwise.profile.v1', '{not json');
    expect(loadProfile()).toBeNull();
  });

  it('defaults invalid preferences', () => {
    localStorage.setItem('smogwise.prefs.v1', JSON.stringify({ theme: 'neon' }));
    expect(loadPrefs()).toEqual({ theme: 'system', textSize: '100' });
  });

  it('caches air for 30 minutes per cell', () => {
    const air = liveAir();
    saveCachedAir(28.7, 77.2, air, 1000);
    expect(loadCachedAir(28.7, 77.2, 1000 + 60_000)).toEqual(air);
    expect(loadCachedAir(28.7, 77.2, 1000 + 31 * 60_000)).toBeNull();
    expect(loadCachedAir(19, 72.8, 1000)).toBeNull();
  });

  it('survives storage that throws (private mode)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => {
      saveProfile(sample('chen'));
    }).not.toThrow();
    setItem.mockRestore();
  });

  it('forgets only Smogwise keys', () => {
    saveProfile(sample('chen'));
    localStorage.setItem('other.app', 'keep');
    sessionStorage.setItem('smogwise.air.1,1', 'x');
    forgetEverything();
    expect(localStorage.getItem('smogwise.profile.v1')).toBeNull();
    expect(sessionStorage.getItem('smogwise.air.1,1')).toBeNull();
    expect(localStorage.getItem('other.app')).toBe('keep');
  });
});

describe('api client', () => {
  it('validates responses and rounds coordinates', async () => {
    const api = stubApi({ '/api/air': liveAir(), '/api/geocode': { results: [] } });
    await expect(fetchAir(28.6519, 77.2315)).resolves.toMatchObject({ source: 'open-meteo' });
    expect(api.calls[0]?.url).toBe('/api/air?lat=28.7&lon=77.2');
    await expect(searchPlaces('Delhi')).resolves.toEqual([]);
    stubApi({ '/api/air': { nope: true } });
    await expect(fetchAir(1, 1)).rejects.toThrow('Unexpected response');
    stubApi({ '/api/air': new Response('x', { status: 500 }) });
    await expect(fetchAir(1, 1)).rejects.toThrow('Request failed with 500');
  });

  it('falls back in the browser for the brief and answers', async () => {
    stubApi({});
    const context = sharmaContext();
    await expect(requestBrief(context)).resolves.toMatchObject({ source: 'rules' });
    await expect(askSmogwise('Mask?', context, 'en')).resolves.toMatchObject({ source: 'rules' });
    await expect(askSmogwise('I cannot breathe', context, 'hi')).resolves.toMatchObject({
      source: 'safety',
    });
  });

  it('posts JSON with the right headers', async () => {
    const api = stubApi({ '/api/brief': { headline: 'H', summary: 'S', source: 'gemini' } });
    await requestBrief(sharmaContext());
    const init = api.calls[0]?.init;
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });
});

describe('what-if mapping', () => {
  it('switches swaps on and off, one commute mode at a time', () => {
    let user = toggleSwap({ kind: 'mode', mode: 'metro' }, {}, true);
    expect(swapIsOn({ kind: 'mode', mode: 'metro' }, user)).toBe(true);
    user = toggleSwap({ kind: 'mode', mode: 'bus' }, user, true);
    expect(user).toEqual({ mode: 'bus' });
    user = toggleSwap({ kind: 'carpool' }, user, true);
    user = toggleSwap({ kind: 'wfhDays', days: 2 }, user, true);
    user = toggleSwap({ kind: 'cooking', fuel: 'lpg' }, user, true);
    user = toggleSwap({ kind: 'heating', heating: 'electric' }, user, true);
    user = toggleSwap({ kind: 'stopBurning' }, user, true);
    expect(user).toEqual({
      mode: 'bus',
      carpool: true,
      wfhDays: 2,
      cooking: 'lpg',
      heating: 'electric',
      stopBurning: true,
    });
    expect(toggleSwap({ kind: 'mode', mode: 'bus' }, user, false)).not.toHaveProperty('mode');
  });

  it('switches hacks on and off on top of the engine defaults', () => {
    const current = { removeSources: ['incense', 'candles'] as const };
    expect(hackIsOn({ kind: 'removeSource', source: 'incense' }, current)).toBe(true);
    expect(toggleHack({ kind: 'removeSource', source: 'incense' }, {}, current, false)).toEqual({
      removeSources: ['candles'],
    });
    expect(toggleHack({ kind: 'removeSource', source: 'smoking' }, {}, {}, true)).toEqual({
      removeSources: ['smoking'],
    });
    const withPurifier = toggleHack({ kind: 'purifier', cadr: 300 }, {}, {}, true);
    expect(hackIsOn({ kind: 'purifier', cadr: 300 }, withPurifier)).toBe(true);
    expect(toggleHack({ kind: 'purifier', cadr: 300 }, withPurifier, withPurifier, false)).toEqual(
      {},
    );
    expect(hackIsOn({ kind: 'sealGaps' }, toggleHack({ kind: 'sealGaps' }, {}, {}, true))).toBe(
      true,
    );
    expect(
      hackIsOn({ kind: 'kitchenExhaust' }, toggleHack({ kind: 'kitchenExhaust' }, {}, {}, false)),
    ).toBe(false);
  });
});

describe('labels, geo and speech', () => {
  it('formats plain-language labels', () => {
    expect(modeLabel('two_wheeler')).toBe('Two-wheeler');
    expect(scaleName('NAQI')).toBe('India AQI');
    expect(scaleName('US_AQI')).toBe('US AQI');
    expect(tierName(4)).toBe('Very unhealthy');
    expect(formatInt(123456)).toBe('1,23,456');
    expect(savingText(3.3, 'kg')).toBe('3.3 kg less');
    expect(savingText(-22, 'kg')).toBe('22 kg more');
    expect(savingText(0, 'g')).toBe('no change in g');
  });

  it('infers the country from the device timezone', () => {
    expect(countryFromTimezone('Asia/Kolkata')).toBe('IN');
    expect(countryFromTimezone('Europe/Paris')).toBe('ZZ');
    expect(
      placeLabel({ name: 'Your area', countryCode: 'ZZ', lat: 1, lon: 1, timezone: 'UTC' }),
    ).toBe('Your area');
  });

  it('detects speech support', () => {
    expect(canSpeak()).toBe(false);
  });
});
