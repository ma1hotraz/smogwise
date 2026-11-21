/** What-if choices: the engine's default recommendations and how choices change the day. */
import { INDOOR_SOURCES, type Lifestyle } from '../schema/profile.js';
import { MODES } from './data/factors.js';
import { TIER } from './data/scales.js';
import type { Choices, Tier, Windows } from './types.js';

/** Free, no-regret actions the plan applies by default (R03, R04, H04–H09). */
export function recommendedChoices(lifestyle: Lifestyle, tierSensitive: Tier): Choices {
  return {
    n95: MODES[lifestyle.commute.mode].exposed && tierSensitive >= TIER.unhealthy,
    smartExercise: lifestyle.exercise.kind === 'outdoor',
    removeSources: INDOOR_SOURCES.filter((s) => lifestyle.sources[s]),
    kitchenExhaust: lifestyle.cooking === 'lpg',
  };
}

/** R03: outdoor exercise moves indoors (tier ≥ 3) or into a meaningful clean window (tier 2). */
function smartExercise(
  exercise: Lifestyle['exercise'],
  tierSensitive: Tier,
  windows: Windows,
): Lifestyle['exercise'] {
  if (tierSensitive >= TIER.unhealthy) {
    return { ...exercise, kind: 'indoor' };
  }
  if (tierSensitive === TIER.caution && windows.clean && windows.meaningful) {
    return { ...exercise, hour: windows.clean.startHour };
  }
  return exercise;
}

/** The lifestyle as it would be lived with these choices. */
export function applyChoices(
  lifestyle: Lifestyle,
  choices: Choices,
  tierSensitive: Tier,
  windows: Windows,
): Lifestyle {
  const outdoor = choices.smartExercise === true && lifestyle.exercise.kind === 'outdoor';
  return {
    ...lifestyle,
    commute: { ...lifestyle.commute, mode: choices.mode ?? lifestyle.commute.mode },
    exercise: outdoor
      ? smartExercise(lifestyle.exercise, tierSensitive, windows)
      : lifestyle.exercise,
    cooking: choices.cooking ?? lifestyle.cooking,
    heating: choices.heating ?? lifestyle.heating,
  };
}

/** Whether a typical weekday includes the commute, after any work-from-home days. */
export function commutes(lifestyle: Lifestyle, wfhDays = 0): boolean {
  const { mode, km, daysPerWeek } = lifestyle.commute;
  return mode !== 'wfh' && km > 0 && daysPerWeek - wfhDays > 0;
}
