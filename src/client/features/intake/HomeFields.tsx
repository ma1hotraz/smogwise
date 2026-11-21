/** The "Your home" fieldset: fuels, heating, room and indoor habits (docs/01 F1). */
import { CheckField, NumberField, SelectField } from '../../components/Fields.js';
import {
  COOKING_LABELS,
  HEATING_LABELS,
  SOURCE_LABELS,
  TIGHTNESS_LABELS,
} from '../../lib/labels.js';
import { MAX_CADR } from '../../../shared/limits.js';
import {
  COOKING_FUELS,
  HEATING_TYPES,
  INDOOR_SOURCES,
  TIGHTNESS,
  type Lifestyle,
} from '../../../shared/schema/profile.js';
import type { LifestyleProps } from './fieldProps.js';

const optionsOf = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const COOKING_OPTIONS = optionsOf(COOKING_FUELS, COOKING_LABELS);
const HEATING_OPTIONS = optionsOf(HEATING_TYPES, HEATING_LABELS);
const TIGHTNESS_OPTIONS = optionsOf(TIGHTNESS, TIGHTNESS_LABELS);

/** Indoor habits that add smoke or dust, plus outdoor burning. */
function IndoorHabits({ value, onChange }: LifestyleProps) {
  return (
    <fieldset class="plain">
      <legend>Indoors, most days</legend>
      {INDOOR_SOURCES.map((source) => (
        <CheckField
          key={source}
          id={`src-${source}`}
          checked={value.sources[source]}
          onChange={(on) => {
            onChange({ ...value, sources: { ...value.sources, [source]: on } });
          }}
        >
          {SOURCE_LABELS[source]}
        </CheckField>
      ))}
      <CheckField
        id="burns"
        checked={value.burnsWaste}
        onChange={(burnsWaste) => {
          onChange({ ...value, burnsWaste });
        }}
      >
        We burn leaves or rubbish outside
      </CheckField>
    </fieldset>
  );
}

/** Cooking fuel and heating. */
function FuelFields({ value, onChange }: LifestyleProps) {
  return (
    <>
      <SelectField
        id="cooking"
        label="Cooking fuel"
        value={value.cooking}
        options={COOKING_OPTIONS}
        onChange={(cooking) => {
          onChange({ ...value, cooking });
        }}
      />
      <SelectField
        id="heating"
        label="Heating"
        value={value.heating}
        options={HEATING_OPTIONS}
        onChange={(heating) => {
          onChange({ ...value, heating });
        }}
      />
    </>
  );
}

/** The main room: air-tightness, size and purifier. */
function RoomFields({ value, onChange }: LifestyleProps) {
  const setHome = (patch: Partial<Lifestyle['home']>): void => {
    onChange({ ...value, home: { ...value.home, ...patch } });
  };
  return (
    <>
      <SelectField
        id="tightness"
        label="Doors and windows"
        value={value.home.tightness}
        options={TIGHTNESS_OPTIONS}
        onChange={(tightness) => {
          setHome({ tightness });
        }}
      />
      <NumberField
        id="room"
        label="Main room size"
        unit="m²"
        hint="A 4 × 4 m room is 16 m²."
        value={value.home.roomM2}
        min={6}
        max={100}
        onChange={(roomM2) => {
          setHome({ roomM2 });
        }}
      />
      <NumberField
        id="cadr"
        label="Air purifier CADR"
        unit="m³/h"
        hint="0 if you have none. It is on the box or label."
        value={value.home.purifierCadr}
        min={0}
        max={MAX_CADR}
        step={10}
        onChange={(purifierCadr) => {
          setHome({ purifierCadr });
        }}
      />
    </>
  );
}

export function HomeFields(props: LifestyleProps) {
  return (
    <fieldset>
      <legend>Your home</legend>
      <div class="grid-2">
        <FuelFields {...props} />
        <RoomFields {...props} />
      </div>
      <IndoorHabits {...props} />
    </fieldset>
  );
}
