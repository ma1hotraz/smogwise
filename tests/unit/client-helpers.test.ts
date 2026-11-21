// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { checkProfile } from '../../src/client/features/intake/IntakeForm.js';
import { nextActive } from '../../src/client/features/intake/LocationField.js';
import { placeFromPosition } from '../../src/client/features/intake/useMyLocation.js';
import { parseReading } from '../../src/client/features/plan/AirHeader.js';
import { sample } from '../helpers/fixtures.js';

describe('intake helpers', () => {
  it('checkProfile asks for a city, flags out-of-range details, and returns a valid profile', () => {
    const { household, lifestyle, location } = sample('chen');
    expect(checkProfile(null, household, lifestyle)).toEqual({
      error: 'Choose your city from the list, or use your location.',
    });
    const tooSmall = { ...lifestyle, home: { ...lifestyle.home, roomM2: 1 } };
    expect(checkProfile(location, household, tooSmall)).toEqual({
      error: 'Some details are out of range. Check the numbers above.',
    });
    expect(checkProfile(location, household, lifestyle)).toMatchObject({ profile: { location } });
  });

  it('nextActive wraps arrow keys around the list and ignores other keys', () => {
    expect(nextActive('ArrowDown', -1, 3)).toBe(0);
    expect(nextActive('ArrowDown', 2, 3)).toBe(0);
    expect(nextActive('ArrowUp', 0, 3)).toBe(2);
    expect(nextActive('Tab', 1, 3)).toBe(1);
    expect(nextActive('ArrowDown', -1, 0)).toBe(0);
  });

  it('placeFromPosition rounds to 0.1° and infers the country from the timezone', () => {
    const position = { coords: { latitude: 28.6519, longitude: 77.2315 } } as GeolocationPosition;
    expect(placeFromPosition(position, 'Asia/Kolkata')).toEqual({
      name: 'Your area',
      countryCode: 'IN',
      lat: 28.7,
      lon: 77.2,
      timezone: 'Asia/Kolkata',
    });
  });
});

describe('manual reading', () => {
  it.each([
    ['150', 150],
    ['0', 0],
    ['2000', 2000],
    ['', null],
    ['  ', null],
    ['-1', null],
    ['2001', null],
    ['abc', null],
  ])('parseReading(%j) is %j', (text, expected) => {
    expect(parseReading(text)).toBe(expected);
  });
});
