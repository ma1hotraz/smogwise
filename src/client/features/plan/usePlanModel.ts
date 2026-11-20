/**
 * View model for the plan: air data, what-if choices, the computed plan and its AI context, plus
 * the screen-reader announcements for data and dose changes. Components only render it.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { buildContext } from '../../../shared/ai/context.js';
import { buildPlan } from '../../../shared/engine/plan.js';
import type { Choices, Plan } from '../../../shared/engine/types.js';
import type { AiContext } from '../../../shared/schema/ai.js';
import type { Profile } from '../../../shared/schema/profile.js';
import { useAnnounce } from '../../lib/announcer.js';
import { useAir, type AirStatus } from '../../lib/useAir.js';

export interface PlanModel {
  plan: Plan;
  context: AiContext;
  status: AirStatus;
  choices: Choices;
  setChoices: (next: Choices) => void;
  setManual: (pm25: number | null) => void;
}

/** Announces when live data arrives or fails, and when the user's choices change the dose. */
function useAnnouncements(status: AirStatus, place: string, reductionPct: number): void {
  const announce = useAnnounce();
  const firstDose = useRef(true);
  useEffect(() => {
    if (status === 'live') {
      announce(`Live air data loaded for ${place}.`);
    } else if (status === 'estimated') {
      announce('Live data is unavailable; showing a seasonal estimate.');
    }
  }, [status, announce, place]);
  useEffect(() => {
    if (firstDose.current) {
      firstDose.current = false;
      return;
    }
    announce(`With your choices: ${reductionPct}% less PM2.5 breathed in today.`);
  }, [reductionPct, announce]);
}

export function usePlanModel(profile: Profile): PlanModel {
  const [manual, setManual] = useState<number | null>(null);
  const [choices, setChoices] = useState<Choices>({});
  const { air, status } = useAir(profile.location, manual);
  const plan = useMemo(() => buildPlan(profile, air, new Date(), choices), [profile, air, choices]);
  const context = useMemo(() => buildContext(plan, profile), [plan, profile]);
  useAnnouncements(status, profile.location.name, plan.exposure.reductionPct);
  return { plan, context, status, choices, setChoices, setManual };
}
