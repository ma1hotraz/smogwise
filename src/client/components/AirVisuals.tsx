/**
 * The day's air: a band chip (shape + label, never colour alone) and a 24-hour strip with an
 * equivalent data table for screen readers and keyboard users (docs/06 §2).
 */
import { useState } from 'preact/hooks';

import { bandFor } from '../../shared/engine/aqi.js';
import type { Band, Level, Scale, Window } from '../../shared/engine/types.js';
import { formatHour } from '../../shared/time.js';

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

const W = 480;
const H = 150;
const BAR = W / 24;
const BASE = 128;

export function HourStrip({ day, scale, nowHour, clean }: HourStripProps) {
  const [table, setTable] = useState(false);
  const top = Math.max(150, ...day);
  const height = (v: number): number => Math.max(2, (v / top) * 100);
  const cleanToday = clean && clean.startHour >= nowHour ? clean : null;
  const summary = `PM2.5 today ranges from ${Math.min(...day)} to ${Math.max(...day)} µg/m³.${
    cleanToday
      ? ` Cleanest ${formatHour(cleanToday.startHour)} to ${formatHour(cleanToday.startHour + cleanToday.hours)}.`
      : ''
  }`;
  return (
    <figure class="strip" aria-labelledby="strip-caption">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
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
        {cleanToday ? (
          <>
            <rect
              class="window"
              x={cleanToday.startHour * BAR}
              y={18}
              width={cleanToday.hours * BAR}
              height={BASE - 18}
              rx={4}
            />
            <text class="window-label" x={cleanToday.startHour * BAR} y={13}>
              Cleanest
            </text>
          </>
        ) : null}
        {day.map((value, hour) => {
          const level = bandFor(value, scale).level;
          const h = height(value);
          return (
            <g key={hour}>
              <rect
                class={`bar lvl-${level}`}
                x={hour * BAR + 2}
                y={BASE - h}
                width={BAR - 4}
                height={h}
                rx={2}
              />
              {level >= 3 ? (
                <rect
                  x={hour * BAR + 2}
                  y={BASE - h}
                  width={BAR - 4}
                  height={h}
                  fill="url(#hatch)"
                />
              ) : null}
            </g>
          );
        })}
        <line
          class="now"
          x1={nowHour * BAR + BAR / 2}
          x2={nowHour * BAR + BAR / 2}
          y1={4}
          y2={BASE}
        />
        {[0, 6, 12, 18].map((hour) => (
          <text key={hour} x={hour * BAR + 2} y={H - 6}>
            {formatHour(hour)}
          </text>
        ))}
      </svg>
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
      <table id="strip-table" hidden={!table}>
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
    </figure>
  );
}
