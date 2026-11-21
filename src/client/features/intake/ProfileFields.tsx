/** Household and travel fieldsets of the intake form (docs/01 F1), driven by field tables. */
import type { Household, Lifestyle } from '../../../shared/schema/profile.js';
import { CheckField, NumberField, SelectField } from '../../components/Fields.js';
import { EXERCISE_OPTIONS, HOUR_OPTIONS, MODE_OPTIONS } from '../../lib/labels.js';
import type { HouseholdProps, LifestyleProps } from './fieldProps.js';

type CountKey = 'adults' | 'over65' | 'under5' | 'children';
type FlagKey = 'pregnant' | 'respiratory' | 'heart';

const COUNTS: readonly { key: CountKey; label: string; max: number }[] = [
  { key: 'adults', label: 'Adults (18–64)', max: 12 },
  { key: 'over65', label: 'Adults over 65', max: 8 },
  { key: 'under5', label: 'Children under 5', max: 8 },
  { key: 'children', label: 'Children 5–17', max: 10 },
];

const FLAGS: readonly { key: FlagKey; label: string }[] = [
  { key: 'pregnant', label: 'Someone is pregnant' },
  { key: 'respiratory', label: 'Someone has asthma or COPD' },
  { key: 'heart', label: 'Someone has a heart condition' },
];

export function HouseholdFields({ value, onChange }: HouseholdProps) {
  const set = (patch: Partial<Household>): void => {
    onChange({ ...value, ...patch });
  };
  return (
    <fieldset>
      <legend>Who lives here</legend>
      <div class="grid-2">
        {COUNTS.map(({ key, label, max }) => (
          <NumberField
            key={key}
            id={key}
            label={label}
            value={value[key]}
            min={0}
            max={max}
            onChange={(n) => {
              set({ [key]: n });
            }}
          />
        ))}
      </div>
      {FLAGS.map(({ key, label }) => (
        <CheckField
          key={key}
          id={key}
          checked={value[key]}
          onChange={(on) => {
            set({ [key]: on });
          }}
        >
          {label}
        </CheckField>
      ))}
    </fieldset>
  );
}

function CommuteFields({ value, onChange }: LifestyleProps) {
  const set = (patch: Partial<Lifestyle['commute']>): void => {
    onChange({ ...value, commute: { ...value.commute, ...patch } });
  };
  const { commute } = value;
  return (
    <>
      <SelectField
        id="mode"
        label="Usual commute"
        value={commute.mode}
        options={MODE_OPTIONS}
        onChange={(mode) => {
          set({ mode });
        }}
      />
      <NumberField
        id="km"
        label="One-way distance"
        unit="km"
        value={commute.km}
        min={0}
        max={80}
        step={0.5}
        onChange={(km) => {
          set({ km });
        }}
      />
      <NumberField
        id="days"
        label="Commute days a week"
        value={commute.daysPerWeek}
        min={0}
        max={7}
        onChange={(daysPerWeek) => {
          set({ daysPerWeek });
        }}
      />
      <SelectField
        id="depart"
        label="Usually leave at"
        value={String(commute.departHour)}
        options={HOUR_OPTIONS}
        onChange={(h) => {
          set({ departHour: Number(h) });
        }}
      />
    </>
  );
}

function ExerciseFields({ value, onChange }: LifestyleProps) {
  const set = (patch: Partial<Lifestyle['exercise']>): void => {
    onChange({ ...value, exercise: { ...value.exercise, ...patch } });
  };
  const { exercise } = value;
  return (
    <>
      <SelectField
        id="exercise"
        label="Exercise"
        value={exercise.kind}
        options={EXERCISE_OPTIONS}
        onChange={(kind) => {
          set({ kind });
        }}
      />
      <SelectField
        id="exercise-hour"
        label="Usually at"
        value={String(exercise.hour)}
        options={HOUR_OPTIONS}
        onChange={(h) => {
          set({ hour: Number(h) });
        }}
      />
      <NumberField
        id="exercise-minutes"
        label="For"
        unit="minutes"
        value={exercise.minutes}
        min={0}
        max={180}
        step={5}
        onChange={(minutes) => {
          set({ minutes });
        }}
      />
    </>
  );
}

export function TravelFields(props: LifestyleProps) {
  return (
    <fieldset>
      <legend>Getting around and staying active</legend>
      <div class="grid-2">
        <CommuteFields {...props} />
        <ExerciseFields {...props} />
      </div>
    </fieldset>
  );
}
