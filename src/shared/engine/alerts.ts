/** AL01–AL06 — safety alerts, most serious first (docs/03). */
import type { AirSource } from '../schema/air.js';
import type { Household, Lifestyle } from '../schema/profile.js';
import { ALERT_COPY, fill, SENSITIVE_LABELS, type Copy } from './data/copy.js';
import { burnsFuelIndoors } from './data/factors.js';
import type { Alert, AlertLevel, RuleId, SensitiveGroup, Tier } from './types.js';
import { TIER } from './data/scales.js';

interface AlertContext {
  lifestyle: Lifestyle;
  household: Household;
  sensitive: readonly SensitiveGroup[];
  tierGeneral: Tier;
  tierSensitive: Tier;
  source: AirSource;
}

interface AlertRule {
  ruleId: RuleId;
  level: AlertLevel;
  when: (ctx: AlertContext) => boolean;
  copy: (ctx: AlertContext) => Copy;
}

const RANK: Record<AlertLevel, number> = { danger: 0, warning: 1, info: 2 };

/** Joins a list as "a, b and c". */
export function listOf(items: readonly string[]): string {
  const head = items.slice(0, -1);
  const last = items.slice(-1).join('');
  return head.length === 0 ? last : `${head.join(', ')} and ${last}`;
}

const RULES: readonly AlertRule[] = [
  {
    ruleId: 'AL01',
    level: 'danger',
    when: (c) => burnsFuelIndoors(c.lifestyle.heating),
    copy: () => ALERT_COPY.AL01,
  },
  {
    ruleId: 'AL04',
    level: 'danger',
    when: (c) => c.tierGeneral === TIER.emergency,
    copy: () => ALERT_COPY.AL04,
  },
  {
    ruleId: 'AL02',
    level: 'warning',
    when: (c) => c.sensitive.length > 0 && c.tierSensitive >= TIER.unhealthy,
    copy: (c) => ({
      title: ALERT_COPY.AL02.title,
      detail: fill(ALERT_COPY.AL02.detail, {
        who: listOf(c.sensitive.map((g) => SENSITIVE_LABELS[g])),
      }),
    }),
  },
  {
    ruleId: 'AL03',
    level: 'warning',
    when: (c) =>
      (c.household.respiratory || c.household.heart || c.household.over65 > 0) &&
      c.tierGeneral >= TIER.veryUnhealthy,
    copy: () => ALERT_COPY.AL03,
  },
  {
    ruleId: 'AL05',
    level: 'warning',
    when: (c) => c.household.pregnant && c.tierGeneral >= TIER.unhealthy,
    copy: () => ALERT_COPY.AL05,
  },
  {
    ruleId: 'AL06',
    level: 'info',
    when: (c) => c.source !== 'open-meteo',
    copy: (c) => (c.source === 'manual' ? ALERT_COPY.AL06_manual : ALERT_COPY.AL06_fallback),
  },
];

/** All alerts that apply, ordered danger → warning → info. */
export function buildAlerts(ctx: AlertContext): Alert[] {
  return RULES.filter((rule) => rule.when(ctx))
    .map((rule) => ({ level: rule.level, ruleId: rule.ruleId, ...rule.copy(ctx) }))
    .sort((a, b) => RANK[a.level] - RANK[b.level]);
}
