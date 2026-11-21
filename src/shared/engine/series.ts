/** Helpers over the hourly forecast series (local wall-clock timestamps). */
import { mean } from '../math.js';
import type { HourlyPoint } from '../schema/air.js';
import { hourOf } from '../time.js';
import type { Trend, Window, Windows } from './types.js';

/** Index of the hour containing `nowKey` (last point at or before it; 0 if all are later). */
export function currentIndex(hourly: readonly HourlyPoint[], nowKey: string): number {
  let index = 0;
  hourly.forEach((point, i) => {
    if (point.time <= nowKey) {
      index = i;
    }
  });
  return index;
}

/** PM2.5 for hours 0–23 of today's local date; missing hours use the current value. */
export function dayProfile(hourly: readonly HourlyPoint[], nowKey: string): number[] {
  const date = nowKey.slice(0, 10);
  const byTime = new Map(hourly.map((p) => [p.time, p.pm25]));
  const fallback = hourly[currentIndex(hourly, nowKey)]?.pm25 ?? 0;
  return Array.from({ length: 24 }, (_, h) => {
    const key = `${date}T${String(h).padStart(2, '0')}:00`;
    return byTime.get(key) ?? fallback;
  });
}

const WAKING_FIRST_START = 6;
const WAKING_LAST_START = 19;
const WINDOW_HOURS = 2;
const LOOKAHEAD = 24;

/** A04: cleanest and worst 2-hour waking blocks in the next 24 hours. */
export function findWindows(hourly: readonly HourlyPoint[], start: number): Windows {
  const candidates: Window[] = [];
  hourly.slice(start, start + LOOKAHEAD).forEach((first, i, ahead) => {
    const second = ahead[i + 1];
    const hour = hourOf(first.time);
    if (second && hour >= WAKING_FIRST_START && hour <= WAKING_LAST_START) {
      const meanPm25 = mean([first.pm25, second.pm25]);
      candidates.push({ startHour: hour, hours: WINDOW_HOURS, meanPm25 });
    }
  });
  if (candidates.length === 0) {
    return { clean: null, worst: null, meaningful: false };
  }
  const clean = candidates.reduce((best, c) => (c.meanPm25 < best.meanPm25 ? c : best));
  const worst = candidates.reduce((top, c) => (c.meanPm25 > top.meanPm25 ? c : top));
  const gap = worst.meanPm25 - clean.meanPm25;
  return {
    clean,
    worst,
    meaningful: gap >= Math.max(MEANINGFUL_GAP.minUg, MEANINGFUL_GAP.fraction * worst.meanPm25),
  };
}

/** A clean window is worth acting on when it beats the worst by 10 µg/m³ or 20 %, whichever is larger. */
const MEANINGFUL_GAP = { minUg: 10, fraction: 0.2 };
const TREND_HOURS = 6;
const TREND_THRESHOLD = 0.1;

/** A05: next-6-hour mean vs. now. */
export function trendFrom(hourly: readonly HourlyPoint[], index: number): Trend {
  const now = hourly[index]?.pm25 ?? 0;
  const next = hourly.slice(index + 1, index + 1 + TREND_HOURS).map((p) => p.pm25);
  if (next.length === 0 || now === 0) {
    return 'steady';
  }
  const change = (mean(next) - now) / now;
  if (change > TREND_THRESHOLD) {
    return 'rising';
  }
  return change < -TREND_THRESHOLD ? 'falling' : 'steady';
}
