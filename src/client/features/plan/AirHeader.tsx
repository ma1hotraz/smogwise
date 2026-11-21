/** The plan's heading: one plain sentence about today's air, with source and controls. */
import { useRef, useState } from 'preact/hooks';

import type { Plan } from '../../../shared/engine/types.js';
import type { Location } from '../../../shared/schema/profile.js';
import { formatWindow } from '../../../shared/time.js';
import { BandChip } from '../../components/AirVisuals.js';
import { scaleName, tierName } from '../../lib/labels.js';
import { useFocusOnMount } from '../../lib/focus.js';
import type { AirStatus } from '../../lib/useAir.js';
import { MAX_PM25 } from '../../../shared/limits.js';

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

/** A typed reading, or null when it is empty or out of range. */
export function parseReading(text: string): number | null {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= MAX_PM25
    ? value
    : null;
}

/** Today's air in one sentence, with the band, household tier, source and GRAP stage. */
function AirSummary({ plan, status }: { plan: Plan; status: AirStatus }) {
  const { air, windows } = plan;
  const clean = windows.clean;
  const when = clean && windows.meaningful ? formatWindow(clean.startHour, clean.hours) : null;
  return (
    <>
      <p class="lede">
        PM2.5 is {air.pm25} µg/m³ ({scaleName(air.scale)} {air.index}) and {air.trend}.{' '}
        {when ? `The cleanest stretch is ${when}.` : 'No time today is meaningfully cleaner.'}
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
    </>
  );
}

/** Use a reading from a local monitor instead of the forecast. */
function ManualReading({ onManual }: { onManual: (pm25: number | null) => void }) {
  const [reading, setReading] = useState('');
  return (
    <form
      class="status-line"
      onSubmit={(event) => {
        event.preventDefault();
        onManual(parseReading(reading));
      }}
    >
      <label htmlFor="manual-pm">PM2.5 now (µg/m³)</label>
      <input
        id="manual-pm"
        type="number"
        min={0}
        max={MAX_PM25}
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
  );
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
  return (
    <header aria-labelledby="plan-title">
      <h1 id="plan-title" ref={heading} tabIndex={-1}>
        {location.name}: {plan.air.band.label.toLowerCase()} air on the {scaleName(plan.air.scale)}{' '}
        scale
      </h1>
      <AirSummary plan={plan} status={status} />
      <details class="no-print">
        <summary>Have a reading from a local monitor, or need to change details?</summary>
        <ManualReading onManual={onManual} />
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
