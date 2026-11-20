/** E — inhaled dose over a typical day, by micro-environment (docs/03). */
import type { Lifestyle } from '../schema/profile.js';
import { cigarettesFor } from './aqi.js';
import { DAY, MODES, N95_FACTOR, RATE } from './data/factors.js';
import { indoorPm, type HomeState } from './indoor.js';
import type { Dose, Place } from './types.js';

const PLACES: readonly Place[] = ['sleep', 'home', 'work', 'commute', 'exercise'];
const MAX_COMMUTE_MIN = 180;

interface Slot {
  free: number;
  minutes: Record<Place, number>;
}

type Schedule = Slot[];

const emptySchedule = (): Schedule =>
  Array.from({ length: 24 }, () => ({
    free: 60,
    minutes: { sleep: 0, home: 0, work: 0, commute: 0, exercise: 0 },
  }));

/** Books minutes from `start`, spilling into later hours when an hour is already taken. */
function book(schedule: Schedule, place: Place, start: number, minutes: number): void {
  const from = start % 24;
  let left = minutes;
  for (const slot of [...schedule.slice(from), ...schedule.slice(0, from)]) {
    const take = Math.min(left, slot.free);
    slot.free -= take;
    slot.minutes[place] += take;
    left -= take;
  }
}

const SLEEP_HOURS = new Set(
  Array.from({ length: DAY.sleepHours }, (_, k) => (DAY.sleepStart + k) % 24),
);

/** Minutes per place for each local hour of a typical day. */
export function schedule(lifestyle: Lifestyle, commuting: boolean): Schedule {
  const plan = emptySchedule();
  const { commute, exercise } = lifestyle;
  const mode = MODES[commute.mode];
  if (commuting && commute.mode !== 'wfh' && commute.km > 0) {
    const leg = Math.min(MAX_COMMUTE_MIN, Math.round((commute.km / mode.speedKmh) * 60));
    book(plan, 'commute', commute.departHour, leg);
    book(plan, 'commute', commute.departHour + DAY.returnAfter, leg);
    book(plan, 'work', commute.departHour, DAY.workHours * 60);
  }
  if (exercise.kind !== 'none' && exercise.minutes > 0) {
    book(plan, 'exercise', exercise.hour, exercise.minutes);
  }
  for (const [hour, slot] of plan.entries()) {
    slot.minutes[SLEEP_HOURS.has(hour) ? 'sleep' : 'home'] += slot.free;
    slot.free = 0;
  }
  return plan;
}

export interface DoseInput {
  /** Ambient PM2.5 for local hours 0–23. */
  ambient: readonly number[];
  lifestyle: Lifestyle;
  home: HomeState;
  n95: boolean;
  commuting: boolean;
}

function exposureAt(
  place: Place,
  outdoor: number,
  input: DoseInput,
): { conc: number; rate: number } {
  const mode = MODES[input.lifestyle.commute.mode];
  switch (place) {
    case 'work':
      return { conc: DAY.workRatio * outdoor, rate: RATE.rest };
    case 'commute': {
      const mask = input.n95 && mode.exposed ? N95_FACTOR : 1;
      return { conc: mode.ratio * outdoor * mask, rate: mode.rate };
    }
    case 'exercise': {
      const outside = input.lifestyle.exercise.kind === 'outdoor';
      return { conc: outside ? outdoor : indoorPm(outdoor, input.home), rate: RATE.exercise };
    }
    default:
      return {
        conc: indoorPm(outdoor, input.home),
        rate: place === 'sleep' ? RATE.sleep : RATE.rest,
      };
  }
}

/** Inhaled PM2.5 dose (µg), volume breathed (m³) and cigarette-equivalent for one day. */
export function doseFor(input: DoseInput): Dose {
  const byPlace: Record<Place, number> = { sleep: 0, home: 0, work: 0, commute: 0, exercise: 0 };
  let volume = 0;
  schedule(input.lifestyle, input.commuting).forEach((slot, hour) => {
    const outdoor = input.ambient[hour] ?? 0;
    for (const place of PLACES) {
      const hours = slot.minutes[place] / 60;
      const { conc, rate } = exposureAt(place, outdoor, input);
      byPlace[place] += conc * rate * hours;
      volume += rate * hours;
    }
  });
  const totalUg = PLACES.reduce((sum, p) => sum + byPlace[p], 0);
  for (const place of PLACES) {
    byPlace[place] = Math.round(byPlace[place]);
  }
  return {
    totalUg: Math.round(totalUg),
    volumeM3: Math.round(volume * 10) / 10,
    byPlace,
    cigarettes: cigarettesFor(totalUg / volume),
  };
}

/** Percentage change from `before` to `after` (negative = reduction). */
export function percentChange(before: number, after: number): number {
  return before === 0 ? 0 : Math.round(((after - before) / before) * 100);
}
