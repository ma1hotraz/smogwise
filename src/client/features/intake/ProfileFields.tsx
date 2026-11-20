/** Household and travel fieldsets of the intake form (docs/01 F1). */
import { CheckField, NumberField, SelectField } from '../../components/Fields.js';
import { HOUR_OPTIONS, MODE_OPTIONS } from '../../lib/labels.js';
import type { Household, Lifestyle } from '../../../shared/schema/profile.js';

interface HouseholdProps {
  value: Household;
  onChange: (next: Household) => void;
}

export function HouseholdFields({ value, onChange }: HouseholdProps) {
  const set = (patch: Partial<Household>): void => {
    onChange({ ...value, ...patch });
  };
  return (
    <fieldset>
      <legend>Who lives here</legend>
      <div class="grid-2">
        <NumberField
          id="adults"
          label="Adults (18–64)"
          value={value.adults}
          min={0}
          max={12}
          onChange={(adults) => {
            set({ adults });
          }}
        />
        <NumberField
          id="over65"
          label="Adults over 65"
          value={value.over65}
          min={0}
          max={8}
          onChange={(over65) => {
            set({ over65 });
          }}
        />
        <NumberField
          id="under5"
          label="Children under 5"
          value={value.under5}
          min={0}
          max={8}
          onChange={(under5) => {
            set({ under5 });
          }}
        />
        <NumberField
          id="children"
          label="Children 5–17"
          value={value.children}
          min={0}
          max={10}
          onChange={(children) => {
            set({ children });
          }}
        />
      </div>
      <CheckField
        id="pregnant"
        checked={value.pregnant}
        onChange={(pregnant) => {
          set({ pregnant });
        }}
      >
        Someone is pregnant
      </CheckField>
      <CheckField
        id="respiratory"
        checked={value.respiratory}
        onChange={(respiratory) => {
          set({ respiratory });
        }}
      >
        Someone has asthma or COPD
      </CheckField>
      <CheckField
        id="heart"
        checked={value.heart}
        onChange={(heart) => {
          set({ heart });
        }}
      >
        Someone has a heart condition
      </CheckField>
    </fieldset>
  );
}

export interface LifestyleProps {
  value: Lifestyle;
  onChange: (next: Lifestyle) => void;
}

export function TravelFields({ value, onChange }: LifestyleProps) {
  const { commute, exercise } = value;
  const setCommute = (patch: Partial<Lifestyle['commute']>): void => {
    onChange({ ...value, commute: { ...commute, ...patch } });
  };
  const setExercise = (patch: Partial<Lifestyle['exercise']>): void => {
    onChange({ ...value, exercise: { ...exercise, ...patch } });
  };
  return (
    <fieldset>
      <legend>Getting around and staying active</legend>
      <div class="grid-2">
        <SelectField
          id="mode"
          label="Usual commute"
          value={commute.mode}
          options={MODE_OPTIONS}
          onChange={(mode) => {
            setCommute({ mode });
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
            setCommute({ km });
          }}
        />
        <NumberField
          id="days"
          label="Commute days a week"
          value={commute.daysPerWeek}
          min={0}
          max={7}
          onChange={(daysPerWeek) => {
            setCommute({ daysPerWeek });
          }}
        />
        <SelectField
          id="depart"
          label="Usually leave at"
          value={String(commute.departHour)}
          options={HOUR_OPTIONS}
          onChange={(h) => {
            setCommute({ departHour: Number(h) });
          }}
        />
        <SelectField
          id="exercise"
          label="Exercise"
          value={exercise.kind}
          options={[
            { value: 'none', label: 'None most days' },
            { value: 'outdoor', label: 'Outdoors (walk, run, cycle, yoga in the park)' },
            { value: 'indoor', label: 'Indoors (home, gym)' },
          ]}
          onChange={(kind) => {
            setExercise({ kind });
          }}
        />
        <SelectField
          id="exercise-hour"
          label="Usually at"
          value={String(exercise.hour)}
          options={HOUR_OPTIONS}
          onChange={(h) => {
            setExercise({ hour: Number(h) });
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
            setExercise({ minutes });
          }}
        />
      </div>
    </fieldset>
  );
}
