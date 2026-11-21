/** R01–R09 — the time-slotted low-emission day (docs/03). */
import type { Household, Lifestyle } from '../schema/profile.js';
import { formatHour, formatWindow, round } from '../time.js';
import { ROUTINE_COPY, fill } from './data/copy.js';
import { burnsFuelIndoors, MODES, N95_FACTOR } from './data/factors.js';
import { commutes } from './choices.js';
import { indoorPm, type HomeState } from './indoor.js';
import type { RoutineStep, RuleId, Tier, Windows } from './types.js';
import { TIER } from './data/scales.js';
import { AIRING_MINUTES, ROUTINE_HOURS } from './data/routine.js';

export interface RoutineContext {
  lifestyle: Lifestyle;
  household: Household;
  ambient: readonly number[];
  tierGeneral: Tier;
  tierSensitive: Tier;
  sensitive: boolean;
  windows: Windows;
  home: HomeState;
}

type CopyKey = keyof typeof ROUTINE_COPY;
type Values = Record<string, string | number>;

/** One routine step from a copy key, with placeholders filled. */
function step(
  hour: number,
  ruleId: RuleId,
  key: CopyKey,
  values: Values = {},
  impact?: string,
): RoutineStep {
  const copy = ROUTINE_COPY[key];
  const base = { hour, ruleId, title: fill(copy.title, values), detail: fill(copy.detail, values) };
  return impact === undefined ? base : { ...base, impact };
}

const ambientAt = (ctx: RoutineContext, hour: number): number => round(ctx.ambient[hour] ?? 0);
const savedPct = (before: number, after: number): number =>
  Math.max(0, Math.round((1 - after / Math.max(before, 1)) * 100));

/** R01 + R02: when to keep windows shut and when to air the home. */
function windowSteps(ctx: RoutineContext): RoutineStep[] {
  const { clean, meaningful } = ctx.windows;
  const steps: RoutineStep[] = [];
  if (
    ctx.tierGeneral >= TIER.caution &&
    clean &&
    meaningful &&
    clean.startHour > ROUTINE_HOURS.morning
  ) {
    const values = {
      time: formatHour(clean.startHour),
      now: ambientAt(ctx, ROUTINE_HOURS.morning),
      clean: round(clean.meanPm25),
    };
    steps.push(step(ROUTINE_HOURS.morning, 'R01', 'shutUntil', values));
  }
  if (ctx.tierGeneral <= TIER.fair) {
    steps.push(step(ROUTINE_HOURS.airFreely, 'R02', 'airFreely'));
  } else if (ctx.tierGeneral === TIER.emergency) {
    steps.push(step(ROUTINE_HOURS.shutAllDay, 'R02', 'shutAllDay'));
  } else if (clean) {
    const span = formatWindow(clean.startHour, clean.hours);
    steps.push(
      step(clean.startHour, 'R02', 'airBurst', {
        minutes:
          ctx.tierGeneral === TIER.veryUnhealthy ? AIRING_MINUTES.short : AIRING_MINUTES.normal,
        span,
      }),
    );
  }
  return steps;
}

/** R03 for outdoor exercisers who can stay outside (tier ≤ 2). */
function outdoorExercise(ctx: RoutineContext, usual: number): RoutineStep {
  const { exercise } = ctx.lifestyle;
  const { clean, meaningful } = ctx.windows;
  if (ctx.tierSensitive === TIER.caution && clean && meaningful) {
    const impact = `About ${savedPct(usual, clean.meanPm25)}% less PM2.5 per breath than at ${formatHour(exercise.hour)}.`;
    const key = ctx.sensitive ? 'exerciseMoveSensitive' : 'exerciseMove';
    return step(clean.startHour, 'R03', key, { time: formatHour(clean.startHour) }, impact);
  }
  return step(
    exercise.hour,
    'R03',
    ctx.tierSensitive === TIER.caution ? 'exerciseLight' : 'exerciseAsUsual',
  );
}

/** R03: exercise timing and place. */
function exerciseSteps(ctx: RoutineContext): RoutineStep[] {
  const { exercise } = ctx.lifestyle;
  if (exercise.kind === 'none' || exercise.minutes === 0) {
    return [];
  }
  const usual = ambientAt(ctx, exercise.hour);
  if (exercise.kind === 'outdoor' && ctx.tierSensitive < TIER.unhealthy) {
    return [outdoorExercise(ctx, usual)];
  }
  const impact = `About ${savedPct(usual, indoorPm(usual, ctx.home))}% less PM2.5 per breath than outside at ${formatHour(exercise.hour)}.`;
  const key = exercise.kind === 'indoor' ? 'exerciseIndoorUsual' : 'exerciseIndoorToday';
  return [step(exercise.hour, 'R03', key, {}, impact)];
}

/** R04: commute protection. Metro riders and home workers need no step. */
function commuteSteps(ctx: RoutineContext): RoutineStep[] {
  const { mode, departHour } = ctx.lifestyle.commute;
  if (!commutes(ctx.lifestyle) || mode === 'metro') {
    return [];
  }
  if (!MODES[mode].exposed) {
    return [step(departHour, 'R04', 'carRecirculate')];
  }
  if (ctx.tierSensitive < TIER.unhealthy) {
    return [step(departHour, 'R04', 'commuteQuiet')];
  }
  const impact = `An N95 cuts what you breathe in on the road by about ${Math.round((1 - N95_FACTOR) * 100)}%.`;
  return [
    step(
      departHour,
      'R04',
      ctx.tierGeneral >= TIER.veryUnhealthy ? 'commuteMetro' : 'commuteMask',
      {},
      impact,
    ),
  ];
}

/** R05, R06, R09: children, cooking and older relatives. */
function householdSteps(ctx: RoutineContext): RoutineStep[] {
  const { household, lifestyle, tierSensitive, windows } = ctx;
  const steps: RoutineStep[] = [];
  if (household.under5 + household.children > 0) {
    steps.push(
      tierSensitive >= TIER.unhealthy
        ? step(ROUTINE_HOURS.play, 'R05', 'playIndoor')
        : step(windows.clean?.startHour ?? ROUTINE_HOURS.play, 'R05', 'playWindow'),
    );
  }
  if (household.over65 > 0 && tierSensitive >= TIER.unhealthy) {
    steps.push(step(ROUTINE_HOURS.elderWalk, 'R09', 'elderWalk'));
  }
  if (lifestyle.cooking !== 'induction') {
    steps.push(
      step(
        ROUTINE_HOURS.cooking,
        'R06',
        lifestyle.cooking === 'biomass' ? 'cookBiomass' : 'cookGas',
      ),
    );
  }
  return steps;
}

/** R07 + R08: heating safety and the night. */
function eveningSteps(ctx: RoutineContext): RoutineStep[] {
  const steps: RoutineStep[] = [];
  if (burnsFuelIndoors(ctx.lifestyle.heating)) {
    steps.push(step(ROUTINE_HOURS.heating, 'R07', 'heatSafely'));
  }
  steps.push(
    step(
      ROUTINE_HOURS.night,
      'R08',
      ctx.lifestyle.home.purifierCadr > 0 ? 'purifierNight' : 'doorNight',
    ),
  );
  return steps;
}

/** The day's routine, ordered by hour. */
export function buildRoutine(ctx: RoutineContext): RoutineStep[] {
  return [
    ...windowSteps(ctx),
    ...exerciseSteps(ctx),
    ...commuteSteps(ctx),
    ...householdSteps(ctx),
    ...eveningSteps(ctx),
  ].sort((a, b) => a.hour - b.hour);
}
