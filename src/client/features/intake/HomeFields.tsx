/** The "Your home" fieldset: fuels, heating, room and indoor habits (docs/01 F1). */
import { CheckField, NumberField, SelectField } from '../../components/Fields.js';
import {
  COOKING_LABELS,
  HEATING_LABELS,
  SOURCE_LABELS,
  TIGHTNESS_LABELS,
} from '../../lib/labels.js';
import {
  COOKING_FUELS,
  HEATING_TYPES,
  INDOOR_SOURCES,
  TIGHTNESS,
  type Lifestyle,
} from '../../../shared/schema/profile.js';
import type { LifestyleProps } from './ProfileFields.js';

const optionsOf = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export function HomeFields({ value, onChange }: LifestyleProps) {
  const setHome = (patch: Partial<Lifestyle['home']>): void => {
    onChange({ ...value, home: { ...value.home, ...patch } });
  };
  return (
    <fieldset>
      <legend>Your home</legend>
      <div class="grid-2">
        <SelectField
          id="cooking"
          label="Cooking fuel"
          value={value.cooking}
          options={optionsOf(COOKING_FUELS, COOKING_LABELS)}
          onChange={(cooking) => {
            onChange({ ...value, cooking });
          }}
        />
        <SelectField
          id="heating"
          label="Heating"
          value={value.heating}
          options={optionsOf(HEATING_TYPES, HEATING_LABELS)}
          onChange={(heating) => {
            onChange({ ...value, heating });
          }}
        />
        <SelectField
          id="tightness"
          label="Doors and windows"
          value={value.home.tightness}
          options={optionsOf(TIGHTNESS, TIGHTNESS_LABELS)}
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
          max={2000}
          step={10}
          onChange={(purifierCadr) => {
            setHome({ purifierCadr });
          }}
        />
      </div>
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
    </fieldset>
  );
}
