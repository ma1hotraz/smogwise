/** R01–R09 — the time-slotted low-emission day (docs/03). */
import type { Household, Lifestyle } from '../schema/profile.js';
import { formatHour, round } from '../time.js';
import { ROUTINE_COPY, fill } from './data/copy.js';
import { MODES, N95_FACTOR } from './data/factors.js';
import { indoorPm, type HomeState } from './indoor.js';
import type { RoutineStep, RuleId, Tier, Windows } from './types.js';

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

const MORNING = 7;

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
  if (ctx.tierGeneral >= 2 && clean && meaningful && clean.startHour > MORNING) {
    const values = {
      time: formatHour(clean.startHour),
      now: ambientAt(ctx, MORNING),
      clean: round(clean.meanPm25),
    };
    steps.push(step(MORNING, 'R01', 'shutUntil', values));
  }
  if (ctx.tierGeneral <= 1) {
    steps.push(step(9, 'R02', 'airFreely'));
  } else if (ctx.tierGeneral === 5) {
    steps.push(step(8, 'R02', 'shutAllDay'));
  } else if (clean) {
    const span = `${formatHour(clean.startHour)}–${formatHour(clean.startHour + clean.hours)}`;
    steps.push(
      step(clean.startHour, 'R02', 'airBurst', { minutes: ctx.tierGeneral === 4 ? 5 : 10, span }),
    );
  }
  return steps;
}

/** R03 for outdoor exercisers who can stay outside (tier ≤ 2). */
function outdoorExercise(ctx: RoutineContext, usual: number): RoutineStep {
  const { exercise } = ctx.lifestyle;
  const { clean, meaningful } = ctx.windows;
  if (ctx.tierSensitive === 2 && clean && meaningful) {
    const impact = `About ${savedPct(usual, clean.meanPm25)}% less PM2.5 per breath than at ${formatHour(exercise.hour)}.`;
    const key = ctx.sensitive ? 'exerciseMoveSensitive' : 'exerciseMove';
    return step(clean.startHour, 'R03', key, { time: formatHour(clean.startHour) }, impact);
  }
  return step(exercise.hour, 'R03', ctx.tierSensitive === 2 ? 'exerciseLight' : 'exerciseAsUsual');
}

/** R03: exercise timing and place. */
function exerciseSteps(ctx: RoutineContext): RoutineStep[] {
  const { exercise } = ctx.lifestyle;
  if (exercise.kind === 'none' || exercise.minutes === 0) {
    return [];
  }
  const usual = ambientAt(ctx, exercise.hour);
  if (exercise.kind === 'outdoor' && ctx.tierSensitive < 3) {
    return [outdoorExercise(ctx, usual)];
  }
  const impact = `About ${savedPct(usual, indoorPm(usual, ctx.home))}% less PM2.5 per breath than outside at ${formatHour(exercise.hour)}.`;
  const key = exercise.kind === 'indoor' ? 'exerciseIndoorUsual' : 'exerciseIndoorToday';
  return [step(exercise.hour, 'R03', key, {}, impact)];
}

/** R04: commute protection. Metro riders and home workers need no step. */
function commuteSteps(ctx: RoutineContext): RoutineStep[] {
  const { mode, km, daysPerWeek, departHour } = ctx.lifestyle.commute;
  if (mode === 'wfh' || mode === 'metro' || km === 0 || daysPerWeek === 0) {
    return [];
  }
  if (!MODES[mode].exposed) {
    return [step(departHour, 'R04', 'carRecirculate')];
  }
  if (ctx.tierSensitive < 3) {
    return [step(departHour, 'R04', 'commuteQuiet')];
  }
  const impact = `An N95 cuts what you breathe in on the road by about ${Math.round((1 - N95_FACTOR) * 100)}%.`;
  return [
    step(departHour, 'R04', ctx.tierGeneral >= 4 ? 'commuteMetro' : 'commuteMask', {}, impact),
  ];
}

/** R05, R06, R09: children, cooking and older relatives. */
function householdSteps(ctx: RoutineContext): RoutineStep[] {
  const { household, lifestyle, tierSensitive, windows } = ctx;
  const steps: RoutineStep[] = [];
  if (household.under5 + household.children > 0) {
    steps.push(
      tierSensitive >= 3
        ? step(16, 'R05', 'playIndoor')
        : step(windows.clean?.startHour ?? 16, 'R05', 'playWindow'),
    );
  }
  if (household.over65 > 0 && tierSensitive >= 3) {
    steps.push(step(17, 'R09', 'elderWalk'));
  }
  if (lifestyle.cooking !== 'induction') {
    steps.push(step(19, 'R06', lifestyle.cooking === 'biomass' ? 'cookBiomass' : 'cookGas'));
  }
  return steps;
}

/** R07 + R08: heating safety and the night. */
function eveningSteps(ctx: RoutineContext): RoutineStep[] {
  const steps: RoutineStep[] = [];
  if (['brazier', 'wood', 'kerosene'].includes(ctx.lifestyle.heating)) {
    steps.push(step(20, 'R07', 'heatSafely'));
  }
  steps.push(step(22, 'R08', ctx.lifestyle.home.purifierCadr > 0 ? 'purifierNight' : 'doorNight'));
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
