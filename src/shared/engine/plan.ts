/**
 * buildPlan — the single entry point of the decision engine. Pure: the same profile, air data,
 * instant and choices always give the same plan (docs/03).
 */
import { mean, reductionPct, round } from '../math.js';
import type { AirData } from '../schema/air.js';
import type { Lifestyle, Profile } from '../schema/profile.js';
import { hourOf, localHourKey } from '../time.js';
import { buildAlerts } from './alerts.js';
import { bandFor, cigarettesFor, indexFor, scaleFor } from './aqi.js';
import { applyChoices, commutes, recommendedChoices } from './choices.js';
import { communityActions } from './community.js';
import { doseFor } from './exposure.js';
import { indoorHacks } from './hacks.js';
import { homeState, indoorPm, indoorRatio, purifierVerdict } from './indoor.js';
import { grapStage } from './location.js';
import { householdTier, sensitiveGroups, tierFor } from './risk.js';
import { buildRoutine } from './routine.js';
import { currentIndex, dayProfile, findWindows, trendFrom } from './series.js';
import { swapsFor } from './swaps.js';
import type { AirSummary, Choices, IndoorSummary, Plan } from './types.js';

function summariseAir(
  profile: Profile,
  air: AirData,
  index: number,
  ambient: number[],
  nowKey: string,
): AirSummary {
  const { countryCode, lat, lon } = profile.location;
  const pm25 = air.hourly[index]?.pm25 ?? 0;
  const scale = scaleFor(countryCode);
  const dayMeanPm25 = round(mean(ambient), 1);
  return {
    pm25: round(pm25, 1),
    index: indexFor(pm25, scale),
    band: bandFor(pm25, scale),
    scale,
    trend: trendFrom(air.hourly, index),
    cigarettes: cigarettesFor(dayMeanPm25),
    dayMeanPm25,
    day: ambient.map((v) => round(v)),
    nowHour: hourOf(nowKey),
    grap: grapStage(countryCode, lat, lon, indexFor(pm25, 'NAQI')),
    source: air.source,
  };
}

function summariseIndoor(lifestyle: Lifestyle, outdoorMean: number): IndoorSummary {
  const home = homeState(lifestyle);
  return {
    ratio: round(indoorRatio(home), 2),
    homePm25: round(indoorPm(outdoorMean, home)),
    hacks: indoorHacks(lifestyle, outdoorMean),
    purifier: purifierVerdict(lifestyle.home.roomM2, lifestyle.home.purifierCadr),
  };
}

function exposure(
  lifestyle: Lifestyle,
  applied: Lifestyle,
  choices: Choices,
  ambient: number[],
): Plan['exposure'] {
  const usual = doseFor({
    ambient,
    lifestyle,
    home: homeState(lifestyle),
    n95: false,
    commuting: commutes(lifestyle),
  });
  const withPlan = doseFor({
    ambient,
    lifestyle: applied,
    home: homeState(applied, choices),
    n95: choices.n95 === true,
    commuting: commutes(applied, choices.wfhDays),
  });
  return { usual, withPlan, reductionPct: reductionPct(usual.totalUg, withPlan.totalUg) };
}

/** Builds the full plan; `choices` override the engine's default recommendations. */
export function buildPlan(profile: Profile, air: AirData, now: Date, choices: Choices = {}): Plan {
  const { lifestyle, household, location } = profile;
  const nowKey = localHourKey(now, air.timezone);
  const index = currentIndex(air.hourly, nowKey);
  const ambient = dayProfile(air.hourly, nowKey);
  const summary = summariseAir(profile, air, index, ambient, nowKey);
  const sensitive = sensitiveGroups(household);
  const tierGeneral = tierFor(summary.pm25);
  const tierSensitive = householdTier(tierGeneral, sensitive.length > 0);
  const windows = findWindows(air.hourly, index);
  const merged: Choices = { ...recommendedChoices(lifestyle, tierSensitive), ...choices };
  const applied = applyChoices(lifestyle, merged, tierSensitive, windows);
  const tiers = { tierGeneral, tierSensitive };
  return {
    air: summary,
    ...tiers,
    sensitive,
    windows,
    routine: buildRoutine({
      // The routine gives its own exercise advice, so it starts from the usual habit.
      lifestyle: { ...applied, exercise: lifestyle.exercise },
      household,
      ambient,
      ...tiers,
      sensitive: sensitive.length > 0,
      windows,
      home: homeState(lifestyle),
    }),
    alerts: buildAlerts({ lifestyle: applied, household, sensitive, ...tiers, source: air.source }),
    indoor: summariseIndoor(lifestyle, summary.dayMeanPm25),
    swaps: swapsFor({ lifestyle, ambient, countryCode: location.countryCode }),
    exposure: exposure(lifestyle, applied, merged, ambient),
    community: communityActions({
      lifestyle,
      household,
      tierGeneral,
      countryCode: location.countryCode,
    }),
    choices: merged,
  };
}
