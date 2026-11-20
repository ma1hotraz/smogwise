// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IntakeForm } from '../../src/client/features/intake/IntakeForm.js';
import { SAMPLES } from '../../src/shared/samples.js';
import { expectAccessible } from '../helpers/a11y.js';
import { stubApi } from '../helpers/browser.js';
import { sample } from '../helpers/fixtures.js';

const DELHI = {
  name: 'Delhi',
  admin1: 'National Capital Territory of Delhi',
  countryCode: 'IN',
  lat: 28.65,
  lon: 77.23,
  timezone: 'Asia/Kolkata',
};
const PUNE = {
  name: 'Pune',
  admin1: 'Maharashtra',
  countryCode: 'IN',
  lat: 18.52,
  lon: 73.86,
  timezone: 'Asia/Kolkata',
};

afterEach(() => {
  vi.useRealTimers();
});

const PLACES = { name: 'Matching places' };

/** An option in the place listbox (selects on the page also have options). */
async function placeOption(name?: RegExp): Promise<HTMLElement> {
  const list = await screen.findByRole('listbox', PLACES);
  return within(list).findByRole('option', name ? { name } : {});
}

describe('IntakeForm', () => {
  it('builds a plan from a sample in one click', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<IntakeForm initial={null} onSubmit={onSubmit} />);
    expect(
      screen.getAllByRole('button', { name: /household|Lahore|Beijing|Gurugram/ }),
    ).toHaveLength(SAMPLES.length);
    await user.click(screen.getByRole('button', { name: /Sharma household/ }));
    expect(onSubmit).toHaveBeenCalledWith(SAMPLES[0]?.profile);
  });

  it('asks for a city and focuses the field when it is missing', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<IntakeForm initial={null} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Build my day' }));
    const input = screen.getByRole('combobox', { name: 'City or town' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleDescription(/Choose your city from the list/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('searches places, picks one with the keyboard and submits a valid profile', async () => {
    stubApi({ '/api/geocode': { results: [DELHI, PUNE] } });
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<IntakeForm initial={null} onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox', { name: 'City or town' });
    await user.type(input, 'Del');
    await placeOption(/Delhi/);
    expect(screen.getByText('2 places found.')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', 'place-0');
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('Delhi, National Capital Territory of Delhi, IN');
    expect(screen.queryByRole('listbox', PLACES)).toBeNull();
    fireEvent.change(screen.getByLabelText('Adults over 65'), { target: { value: '1' } });
    await user.click(screen.getByLabelText('Someone has asthma or COPD'));
    await user.selectOptions(screen.getByLabelText('Usual commute'), 'two_wheeler');
    await user.selectOptions(screen.getByLabelText('Heating'), 'brazier');
    await user.click(screen.getByLabelText('Incense (agarbatti) most days'));
    await user.click(screen.getByRole('button', { name: 'Build my day' }));
    const profile = onSubmit.mock.calls[0]?.[0];
    expect(profile).toMatchObject({ location: DELHI, household: { over65: 1, respiratory: true } });
    expect(profile.lifestyle).toMatchObject({
      heating: 'brazier',
      commute: { mode: 'two_wheeler' },
      sources: { incense: true },
    });
  });

  it('chooses with the mouse, closes with Escape and reports empty or failed searches', async () => {
    const user = userEvent.setup();
    const api = stubApi({ '/api/geocode': { results: [PUNE] } });
    render(<IntakeForm initial={null} onSubmit={() => undefined} />);
    const input = screen.getByRole('combobox', { name: 'City or town' });
    await user.type(input, 'Pun');
    await placeOption(/Pune/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', PLACES)).toBeNull();
    await user.type(input, 'e');
    fireEvent.mouseDown(await placeOption(/Pune/));
    expect(input).toHaveValue('Pune, Maharashtra, IN');
    api.fn.mockImplementation(() => Promise.resolve(Response.json({ results: [] })));
    await user.clear(input);
    await user.type(input, 'Zzz');
    expect(await screen.findByText('No places found. Try a nearby city.')).toBeInTheDocument();
    api.fn.mockImplementation(() => Promise.reject(new TypeError('offline')));
    await user.type(input, 'q');
    expect(await screen.findByText(/Place search is unavailable/)).toBeInTheDocument();
  });

  it('uses rounded geolocation with the device timezone', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => {
      ok({ coords: { latitude: 28.6519, longitude: 77.2315 } } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<IntakeForm initial={null} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByText('Using your area, rounded to about 11 km.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Build my day' }));
    expect(onSubmit.mock.calls[0]?.[0].location).toMatchObject({
      name: 'Your area',
      lat: 28.7,
      lon: 77.2,
    });
  });

  it('explains a refused location permission and a missing API', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => {
          fail({} as GeolocationPositionError);
        },
      },
      configurable: true,
    });
    const { unmount } = render(<IntakeForm initial={null} onSubmit={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByText(/permission was not given/)).toBeInTheDocument();
    unmount();
    // @ts-expect-error -- simulate a browser without the Geolocation API
    delete navigator.geolocation;
    render(<IntakeForm initial={null} onSubmit={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByText(/not available in this browser/)).toBeInTheDocument();
  });

  it('lets every household and lifestyle field change the submitted profile', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<IntakeForm initial={sample('chen')} onSubmit={onSubmit} />);
    const numbers: [string, string][] = [
      ['Adults (18–64)', '3'],
      ['Children under 5', '1'],
      ['Children 5–17', '2'],
      ['One-way distance (km)', '6'],
      ['Commute days a week', '4'],
      ['For (minutes)', '45'],
      ['Main room size (m²)', '20'],
      ['Air purifier CADR (m³/h)', '250'],
    ];
    for (const [label, value] of numbers) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const selects: [string, string][] = [
      ['Usually leave at', '8'],
      ['Exercise', 'outdoor'],
      ['Usually at', '15'],
      ['Cooking fuel', 'biomass'],
      ['Doors and windows', 'leaky'],
    ];
    for (const [label, value] of selects) {
      await user.selectOptions(screen.getByLabelText(label), value);
    }
    for (const label of [
      'Someone is pregnant',
      'Someone has a heart condition',
      'We burn leaves or rubbish outside',
    ]) {
      await user.click(screen.getByLabelText(label));
    }
    await user.click(screen.getByRole('button', { name: 'Build my day' }));
    const profile = onSubmit.mock.calls[0]?.[0];
    expect(profile.household).toMatchObject({
      adults: 3,
      under5: 1,
      children: 2,
      pregnant: true,
      heart: true,
    });
    expect(profile.lifestyle).toMatchObject({
      commute: { km: 6, daysPerWeek: 4, departHour: 8 },
      exercise: { kind: 'outdoor', hour: 15, minutes: 45 },
      cooking: 'biomass',
      home: { tightness: 'leaky', roomM2: 20, purifierCadr: 250 },
      burnsWaste: true,
    });
  });

  it('pre-fills an existing profile for editing', () => {
    render(<IntakeForm initial={sample('rohit')} onSubmit={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'City or town' })).toHaveValue(
      'Gurugram, Haryana, IN',
    );
    expect(screen.getByLabelText('Heating')).toHaveValue('brazier');
  });

  it('reports out-of-range details', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const broken = sample('chen');
    broken.lifestyle.home.roomM2 = 1;
    render(<IntakeForm initial={broken} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Build my day' }));
    expect(screen.getByText(/out of range/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('has no axe violations, including with the listbox open', async () => {
    stubApi({ '/api/geocode': { results: [DELHI] } });
    const user = userEvent.setup();
    const { container } = render(<IntakeForm initial={null} onSubmit={() => undefined} />);
    await expectAccessible(container);
    await user.type(screen.getByRole('combobox', { name: 'City or town' }), 'Del');
    await placeOption();
    await expectAccessible(container);
  });
});
