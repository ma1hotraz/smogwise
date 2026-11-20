/** Labelled native form fields: real <label>s, hints linked by aria-describedby. */
import type { ComponentChildren } from 'preact';

interface BaseProps {
  id: string;
  label: string;
  hint?: string;
}

const describedBy = (id: string, hint?: string): string | undefined =>
  hint ? `${id}-hint` : undefined;

function Hint({ id, hint }: { id: string; hint?: string | undefined }) {
  return hint ? (
    <span class="hint" id={`${id}-hint`}>
      {hint}
    </span>
  ) : null;
}

interface NumberFieldProps extends BaseProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

/** Number input that clamps to its range, so the profile is always valid. */
export function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: NumberFieldProps) {
  return (
    <div class="field">
      <label htmlFor={id}>
        {label}
        {unit ? <span class="hint"> ({unit})</span> : null}
      </label>
      <Hint id={id} hint={hint} />
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={describedBy(id, hint)}
        onChange={(event) => {
          const parsed = Number(event.currentTarget.value);
          onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min);
        }}
      />
    </div>
  );
}

interface SelectFieldProps<T extends string> extends BaseProps {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <div class="field">
      <label htmlFor={id}>{label}</label>
      <Hint id={id} hint={hint} />
      <select
        id={id}
        value={value}
        aria-describedby={describedBy(id, hint)}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.currentTarget.value);
          if (next) {
            onChange(next.value);
          }
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface CheckFieldProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ComponentChildren;
  describedById?: string;
}

export function CheckField({ id, checked, onChange, children, describedById }: CheckFieldProps) {
  return (
    <div class="check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={describedById}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}
