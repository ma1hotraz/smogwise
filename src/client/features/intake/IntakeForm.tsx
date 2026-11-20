/** First screen: sample households for a one-click plan, or the family's own details (F1). */
import { useRef, useState } from 'preact/hooks';

import { useFocusOnMount } from '../../lib/focus.js';

import { SAMPLES } from '../../../shared/samples.js';
import {
  Profile,
  type Household,
  type Lifestyle,
  type Location,
} from '../../../shared/schema/profile.js';
import { LocationField } from './LocationField.js';
import { HomeFields } from './HomeFields.js';
import { HouseholdFields, TravelFields } from './ProfileFields.js';

const DEFAULT_HOUSEHOLD: Household = {
  adults: 2,
  under5: 0,
  children: 0,
  over65: 0,
  pregnant: false,
  respiratory: false,
  heart: false,
};

const DEFAULT_LIFESTYLE: Lifestyle = {
  commute: { mode: 'metro', km: 8, daysPerWeek: 5, departHour: 9 },
  exercise: { kind: 'outdoor', hour: 7, minutes: 30 },
  cooking: 'lpg',
  heating: 'none',
  home: { tightness: 'average', roomM2: 16, purifierCadr: 0 },
  sources: {
    smoking: false,
    incense: false,
    mosquitoCoil: false,
    candles: false,
    drySweeping: false,
  },
  burnsWaste: false,
};

interface IntakeFormProps {
  initial: Profile | null;
  /** Focus the heading on mount (after navigating here). */
  focusHeading?: boolean;
  onSubmit: (profile: Profile) => void;
}

export function IntakeForm({ initial, focusHeading = false, onSubmit }: IntakeFormProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(heading, focusHeading);
  const [location, setLocation] = useState<Location | null>(initial?.location ?? null);
  const [household, setHousehold] = useState<Household>(initial?.household ?? DEFAULT_HOUSEHOLD);
  const [lifestyle, setLifestyle] = useState<Lifestyle>(initial?.lifestyle ?? DEFAULT_LIFESTYLE);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (event: Event): void => {
    event.preventDefault();
    const parsed = Profile.safeParse({ version: 1, location, household, lifestyle });
    if (!location || !parsed.success) {
      setError(
        location
          ? 'Some details are out of range. Check the numbers above.'
          : 'Choose your city from the list, or use your location.',
      );
      formRef.current?.querySelector<HTMLInputElement>('#place')?.focus();
      return;
    }
    setError(null);
    onSubmit(parsed.data);
  };

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        Plan a cleaner-air day for your family
      </h1>
      <p class="lede">
        Smogwise reads the next two days of smog forecast for your area and tells you when to air
        the home, exercise and travel, which indoor fixes help most, and what each choice changes.
      </p>
      <section aria-labelledby="samples-title">
        <h2 id="samples-title">See it with a sample household</h2>
        <ul class="samples">
          {SAMPLES.map((sample) => (
            <li key={sample.id}>
              <button
                class="sample"
                type="button"
                onClick={() => {
                  onSubmit(sample.profile);
                }}
              >
                <strong>{sample.label}</strong>
                <span>{sample.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="own-title">
        <h2 id="own-title">Or tell Smogwise about your home</h2>
        <fieldset>
          <legend>Where you live</legend>
          <LocationField
            value={location}
            error={error}
            onChange={(next) => {
              setLocation(next);
              setError(null);
            }}
          />
        </fieldset>
        <HouseholdFields value={household} onChange={setHousehold} />
        <TravelFields value={lifestyle} onChange={setLifestyle} />
        <HomeFields value={lifestyle} onChange={setLifestyle} />
        <p class="hint">Your answers stay in this browser. Nothing is stored on a server.</p>
        <button class="button" type="submit">
          Build my day
        </button>
      </form>
    </>
  );
}
