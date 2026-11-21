/**
 * The day's air: a band chip (shape + label, never colour alone) and a 24-hour strip with an
 * equivalent data table for screen readers and keyboard users (docs/06 §2).
 */
import { useState } from 'preact/hooks';

import { bandFor } from '../../shared/engine/aqi.js';
import type { Band, Level, Scale, Window } from '../../shared/engine/types.js';
import { formatHour, formatWindow } from '../../shared/time.js';

/** Each level has its own shape so the band reads without colour. */
const SHAPES: Record<Level, string> = {
  0: 'M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1z',
  1: 'M2 2h12v12H2z',
  2: 'M8 1l7 13H1z',
  3: 'M8 1l7 7-7 7-7-7z',
  4: 'M5 1h6l4 4v6l-4 4H5l-4-4V5z',
  5: 'M1 3l2-2 5 5 5-5 2 2-5 5 5 5-2 2-5-5-5 5-2-2 5-5z',
};

export function BandChip({ band }: { band: Band }) {
  return (
    <span class={`band band-${band.level}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d={SHAPES[band.level]} />
      </svg>
      {band.label}
    </span>
  );
}

interface HourStripProps {
  day: readonly number[];
  scale: Scale;
  nowHour: number;
  clean: Window | null;
}

/** Chart geometry in SVG units: 24 bars on a fixed baseline, scaled to the day's worst hour. */
const CHART = { width: 480, height: 150, baseline: 128, barHeight: 100, minScale: 150 } as const;
const BAR = CHART.width / 24;
const HATCH_FROM_LEVEL = 3;
const AXIS_HOURS = [0, 6, 12, 18] as const;

interface ChartProps {
  day: readonly number[];
  scale: Scale;
  nowHour: number;
  clean: Window | null;
  summary: string;
}

function HourBar({
  hour,
  value,
  scale,
  top,
}: {
  hour: number;
  value: number;
  scale: Scale;
  top: number;
}) {
  const level = bandFor(value, scale).level;
  const h = Math.max(2, (value / top) * CHART.barHeight);
  const box = { x: hour * BAR + 2, y: CHART.baseline - h, width: BAR - 4, height: h };
  return (
    <g>
      <rect class={`bar lvl-${level}`} {...box} rx={2} />
      {level >= HATCH_FROM_LEVEL ? <rect {...box} fill="url(#hatch)" /> : null}
    </g>
  );
}

function CleanWindowMark({ clean }: { clean: Window }) {
  return (
    <>
      <rect
        class="window"
        x={clean.startHour * BAR}
        y={18}
        width={clean.hours * BAR}
        height={CHART.baseline - 18}
        rx={4}
      />
      <text class="window-label" x={clean.startHour * BAR} y={13}>
        Cleanest
      </text>
    </>
  );
}

function StripChart({ day, scale, nowHour, clean, summary }: ChartProps) {
  const top = Math.max(CHART.minScale, ...day);
  const nowX = nowHour * BAR + BAR / 2;
  return (
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={summary}>
      <defs>
        <pattern
          id="hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line class="hatch-line" x1="0" y1="0" x2="0" y2="6" />
        </pattern>
      </defs>
      {clean ? <CleanWindowMark clean={clean} /> : null}
      {day.map((value, hour) => (
        <HourBar key={hour} hour={hour} value={value} scale={scale} top={top} />
      ))}
      <line class="now" x1={nowX} x2={nowX} y1={4} y2={CHART.baseline} />
      {AXIS_HOURS.map((hour) => (
        <text key={hour} x={hour * BAR + 2} y={CHART.height - 6}>
          {formatHour(hour)}
        </text>
      ))}
    </svg>
  );
}

/** The same data as a table, for screen readers and anyone who prefers numbers. */
function StripTable({
  day,
  scale,
  hidden,
}: {
  day: readonly number[];
  scale: Scale;
  hidden: boolean;
}) {
  return (
    <table id="strip-table" hidden={hidden}>
      <caption>PM2.5 by hour today</caption>
      <thead>
        <tr>
          <th scope="col">Hour</th>
          <th scope="col">PM2.5 (µg/m³)</th>
          <th scope="col">Band</th>
        </tr>
      </thead>
      <tbody>
        {day.map((value, hour) => (
          <tr key={hour}>
            <th scope="row">{formatHour(hour)}</th>
            <td>{value}</td>
            <td>{bandFor(value, scale).label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function HourStrip({ day, scale, nowHour, clean }: HourStripProps) {
  const [table, setTable] = useState(false);
  const cleanToday = clean && clean.startHour >= nowHour ? clean : null;
  const window = cleanToday
    ? ` Cleanest ${formatWindow(cleanToday.startHour, cleanToday.hours, ' to ')}.`
    : '';
  const summary = `PM2.5 today ranges from ${Math.min(...day)} to ${Math.max(...day)} µg/m³.${window}`;
  return (
    <figure class="strip" aria-labelledby="strip-caption">
      <StripChart day={day} scale={scale} nowHour={nowHour} clean={cleanToday} summary={summary} />
      <figcaption id="strip-caption" class="status-line">
        <span>
          PM2.5 by hour today (µg/m³). Dashed line: now. Hatched bars: unhealthy or worse.
        </span>
        <button
          class="button button-quiet button-small no-print"
          type="button"
          aria-expanded={table}
          aria-controls="strip-table"
          onClick={() => {
            setTable(!table);
          }}
        >
          {table ? 'Hide table' : 'Show as table'}
        </button>
      </figcaption>
      <StripTable day={day} scale={scale} hidden={!table} />
    </figure>
  );
}
