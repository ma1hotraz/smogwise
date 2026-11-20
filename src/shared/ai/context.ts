/**
 * Builds the only data the model ever sees (docs/04 §3): a summary of the plan with no
 * coordinates, names or exact household composition.
 */
import type { Plan, Window } from '../engine/types.js';
import type { AiContext } from '../schema/ai.js';
import type { Profile } from '../schema/profile.js';
import { formatHour, round } from '../time.js';

const MAX_STEPS = 6;
const MAX_EXTRAS = 2;

function windowSummary(window: Window | null): AiContext['cleanWindow'] {
  return window
    ? {
        start: formatHour(window.startHour),
        end: formatHour(window.startHour + window.hours),
        pm25: round(window.meanPm25),
      }
    : null;
}

/** Top actions: routine steps first, then the best indoor hacks and swaps. */
function topActions(plan: Plan): AiContext['actions'] {
  const steps = plan.routine.slice(0, MAX_STEPS).map((s) => ({ id: s.ruleId, title: s.title }));
  const hacks = plan.indoor.hacks
    .filter((h) => h.reductionPct !== null)
    .slice(0, MAX_EXTRAS)
    .map((h) => ({ id: h.ruleId, title: h.title }));
  const swaps = plan.swaps.slice(0, MAX_EXTRAS).map((s) => ({ id: s.ruleId, title: s.title }));
  return [...steps, ...hacks, ...swaps];
}

/** Summarises a plan for the AI routes. */
export function buildContext(plan: Plan, profile: Profile): AiContext {
  const { usual, withPlan, reductionPct } = plan.exposure;
  return {
    city: profile.location.name,
    country: profile.location.countryCode,
    scale: plan.air.scale,
    pm25: round(plan.air.pm25),
    index: plan.air.index,
    band: plan.air.band.label,
    tier: plan.tierGeneral,
    trend: plan.air.trend,
    sensitive: plan.sensitive,
    cleanWindow: windowSummary(plan.windows.clean),
    worstWindow: windowSummary(plan.windows.worst),
    alerts: plan.alerts.slice(0, 6).map((a) => ({ id: a.ruleId, title: a.title })),
    actions: topActions(plan),
    dose: {
      usualUg: usual.totalUg,
      planUg: withPlan.totalUg,
      reductionPct,
      cigarettesUsual: usual.cigarettes,
      cigarettesPlan: withPlan.cigarettes,
    },
    commute: { mode: profile.lifestyle.commute.mode, km: profile.lifestyle.commute.km },
    grap: plan.air.grap,
    source: plan.air.source,
  };
}
