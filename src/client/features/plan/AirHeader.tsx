/** The plan's heading: one plain sentence about today's air, with source and controls. */
import { useRef, useState } from 'preact/hooks';

import type { Plan } from '../../../shared/engine/types.js';
import type { Location } from '../../../shared/schema/profile.js';
import { formatHour } from '../../../shared/time.js';
import { BandChip } from '../../components/AirVisuals.js';
import { scaleName, tierName } from '../../lib/labels.js';
import { useFocusOnMount } from '../../lib/focus.js';
import type { AirStatus } from '../../lib/useAir.js';

const STATUS_TEXT: Record<AirStatus, string> = {
  loading: 'Fetching the live forecast… showing a seasonal estimate meanwhile.',
  live: 'Live forecast: CAMS model via Open-Meteo.',
  estimated: 'Live data is unavailable: seasonal estimate.',
  manual: 'Using the PM2.5 reading you entered.',
};

interface AirHeaderProps {
  focusHeading: boolean;
  plan: Plan;
  location: Location;
  status: AirStatus;
  onManual: (pm25: number | null) => void;
  onEdit: () => void;
  onForget: () => void;
}

export function AirHeader({
  focusHeading,
  plan,
  location,
  status,
  onManual,
  onEdit,
  onForget,
}: AirHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(heading, focusHeading);
  const { air, windows } = plan;
  const [reading, setReading] = useState('');
  const clean = windows.clean;
  const when = clean
    ? `${formatHour(clean.startHour)}–${formatHour(clean.startHour + clean.hours)}`
    : null;
  return (
    <header aria-labelledby="plan-title">
      <h1 id="plan-title" ref={heading} tabIndex={-1}>
        {location.name}: {air.band.label.toLowerCase()} air on the {scaleName(air.scale)} scale
      </h1>
      <p class="lede">
        PM2.5 is {air.pm25} µg/m³ ({scaleName(air.scale)} {air.index}) and {air.trend}.{' '}
        {when && windows.meaningful
          ? `The cleanest stretch is ${when}.`
          : 'No time today is meaningfully cleaner.'}
      </p>
      <div class="status-line">
        <BandChip band={air.band} />
        <span>
          For your household: <strong>{tierName(plan.tierSensitive).toLowerCase()}</strong>
        </span>
        <span>Breathing outdoor air all day ≈ {air.cigarettes} cigarettes.</span>
        {air.grap ? <span>Delhi NCR GRAP stage {air.grap} (indicative).</span> : null}
        <span>{STATUS_TEXT[status]}</span>
      </div>
      <details class="no-print">
        <summary>Have a reading from a local monitor, or need to change details?</summary>
        <form
          class="status-line"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(reading);
            onManual(
              reading.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 2000
                ? value
                : null,
            );
          }}
        >
          <label htmlFor="manual-pm">PM2.5 now (µg/m³)</label>
          <input
            id="manual-pm"
            type="number"
            min={0}
            max={2000}
            value={reading}
            onInput={(e) => {
              setReading(e.currentTarget.value);
            }}
          />
          <button class="button button-small" type="submit">
            Use this reading
          </button>
          <button
            class="button button-quiet button-small"
            type="button"
            onClick={() => {
              setReading('');
              onManual(null);
            }}
          >
            Back to the forecast
          </button>
        </form>
        <p class="status-line">
          <button class="button button-quiet button-small" type="button" onClick={onEdit}>
            Edit household details
          </button>
          <button class="button button-quiet button-small" type="button" onClick={onForget}>
            Forget my data
          </button>
        </p>
      </details>
    </header>
  );
}
