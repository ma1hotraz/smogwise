/** E — inhaled dose over a typical day, by micro-environment (docs/03). */
import { round } from '../math.js';
import type { Lifestyle } from '../schema/profile.js';
import { cigarettesFor } from './aqi.js';
import { DAY, MODES, N95_FACTOR, RATE } from './data/factors.js';
import { type HomeState, indoorPm } from './indoor.js';
import type { Dose, MicroEnv } from './types.js';

const ENVS: readonly MicroEnv[] = ['sleep', 'home', 'work', 'commute', 'exercise'];
const MAX_COMMUTE_MIN = 180;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

interface Slot {
  free: number;
  minutes: Record<MicroEnv, number>;
}

type Schedule = Slot[];

const emptySchedule = (): Schedule =>
  Array.from({ length: HOURS_PER_DAY }, () => ({
    free: MINUTES_PER_HOUR,
    minutes: { sleep: 0, home: 0, work: 0, commute: 0, exercise: 0 },
  }));

/** Books minutes from `start`, spilling into later hours when an hour is already taken. */
function book(schedule: Schedule, place: MicroEnv, start: number, minutes: number): void {
  const from = start % HOURS_PER_DAY;
  let left = minutes;
  for (const slot of [...schedule.slice(from), ...schedule.slice(0, from)]) {
    const take = Math.min(left, slot.free);
    slot.free -= take;
    slot.minutes[place] += take;
    left -= take;
  }
}

const SLEEP_HOURS = new Set(
  Array.from({ length: DAY.sleepHours }, (_, k) => (DAY.sleepStart + k) % HOURS_PER_DAY),
);

/** Minutes per micro-environment for each local hour of a typical day. */
export function schedule(lifestyle: Lifestyle, commuting: boolean): Schedule {
  const day = emptySchedule();
  const { commute, exercise } = lifestyle;
  const mode = MODES[commute.mode];
  if (commuting && commute.mode !== 'wfh' && commute.km > 0) {
    const leg = Math.min(
      MAX_COMMUTE_MIN,
      Math.round((commute.km / mode.speedKmh) * MINUTES_PER_HOUR),
    );
    book(day, 'commute', commute.departHour, leg);
    book(day, 'commute', commute.departHour + DAY.returnAfter, leg);
    book(day, 'work', commute.departHour, DAY.workHours * MINUTES_PER_HOUR);
  }
  if (exercise.kind !== 'none' && exercise.minutes > 0) {
    book(day, 'exercise', exercise.hour, exercise.minutes);
  }
  for (const [hour, slot] of day.entries()) {
    slot.minutes[SLEEP_HOURS.has(hour) ? 'sleep' : 'home'] += slot.free;
    slot.free = 0;
  }
  return day;
}

interface DoseInput {
  /** Ambient PM2.5 for local hours 0–23. */
  ambient: readonly number[];
  lifestyle: Lifestyle;
  home: HomeState;
  n95: boolean;
  commuting: boolean;
}

interface Exposure {
  conc: number;
  rate: number;
}

/** Concentration and breathing rate for each micro-environment, given the hour's outdoor PM2.5. */
const EXPOSURE: Record<MicroEnv, (outdoor: number, input: DoseInput) => Exposure> = {
  sleep: (outdoor, input) => ({ conc: indoorPm(outdoor, input.home), rate: RATE.sleep }),
  home: (outdoor, input) => ({ conc: indoorPm(outdoor, input.home), rate: RATE.rest }),
  work: (outdoor) => ({ conc: DAY.workRatio * outdoor, rate: RATE.rest }),
  commute: (outdoor, input) => {
    const mode = MODES[input.lifestyle.commute.mode];
    const mask = input.n95 && mode.exposed ? N95_FACTOR : 1;
    return { conc: mode.ratio * outdoor * mask, rate: mode.rate };
  },
  exercise: (outdoor, input) => {
    const outside = input.lifestyle.exercise.kind === 'outdoor';
    return { conc: outside ? outdoor : indoorPm(outdoor, input.home), rate: RATE.exercise };
  },
};

/** Inhaled PM2.5 dose (µg), volume breathed (m³) and cigarette-equivalent for one day. */
export function doseFor(input: DoseInput): Dose {
  const byPlace: Record<MicroEnv, number> = { sleep: 0, home: 0, work: 0, commute: 0, exercise: 0 };
  let volume = 0;
  schedule(input.lifestyle, input.commuting).forEach((slot, hour) => {
    const outdoor = input.ambient[hour] ?? 0;
    for (const place of ENVS) {
      const hours = slot.minutes[place] / MINUTES_PER_HOUR;
      const { conc, rate } = EXPOSURE[place](outdoor, input);
      byPlace[place] += conc * rate * hours;
      volume += rate * hours;
    }
  });
  const totalUg = ENVS.reduce((sum, p) => sum + byPlace[p], 0);
  for (const place of ENVS) {
    byPlace[place] = Math.round(byPlace[place]);
  }
  return {
    totalUg: Math.round(totalUg),
    volumeM3: round(volume, 1),
    byPlace,
    cigarettes: cigarettesFor(totalUg / volume),
  };
}
