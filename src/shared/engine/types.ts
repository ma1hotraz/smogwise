/** Output types of the decision engine (docs/02 §4, docs/03). */
import type { AirSource } from '../schema/air.js';
import type { CommuteMode, CookingFuel, Heating, IndoorSource } from '../schema/profile.js';

export type Scale = 'NAQI' | 'US_AQI';
/** 0 = cleanest band … 5 = worst band of the active scale. */
export type Level = 0 | 1 | 2 | 3 | 4 | 5;
/** Health-based personal tier (docs/03 A03). */
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export type Trend = 'rising' | 'falling' | 'steady';
export type GrapStage = 'I' | 'II' | 'III' | 'IV';

export type SensitiveGroup = 'under5' | 'over65' | 'pregnant' | 'respiratory' | 'heart';

export interface Band {
  level: Level;
  label: string;
}

export interface AirSummary {
  pm25: number;
  index: number;
  band: Band;
  scale: Scale;
  trend: Trend;
  /** Cigarette-equivalent of breathing outdoor air for 24 h at today's mean (A06). */
  cigarettes: number;
  dayMeanPm25: number;
  /** Ambient PM2.5 for local hours 0–23 today. */
  day: number[];
  /** Current local hour, 0–23. */
  nowHour: number;
  grap: GrapStage | null;
  source: AirSource;
}

export interface Window {
  /** Local start hour 0–23 and the block length in hours. */
  startHour: number;
  hours: number;
  meanPm25: number;
}

export interface Windows {
  clean: Window | null;
  worst: Window | null;
  meaningful: boolean;
}

export type RuleId = `${'A' | 'L' | 'H' | 'E' | 'R' | 'S' | 'C' | 'AL'}${number}`;

export interface RoutineStep {
  hour: number;
  title: string;
  detail: string;
  ruleId: RuleId;
  impact?: string;
}

export type AlertLevel = 'danger' | 'warning' | 'info';

export interface Alert {
  level: AlertLevel;
  title: string;
  detail: string;
  ruleId: RuleId;
}

export type Cost = 'free' | 'low' | 'medium' | 'none';

export interface Hack {
  id: string;
  ruleId: RuleId;
  title: string;
  detail: string;
  cost: Cost;
  /** Modelled reduction of daily-average home PM2.5, 0–100; null for information cards. */
  reductionPct: number | null;
  /** The choice this hack maps to in the what-if panel, if any. */
  choice: HackChoice | null;
}

export type HackChoice =
  | { kind: 'purifier'; cadr: number }
  | { kind: 'sealGaps' }
  | { kind: 'removeSource'; source: IndoorSource }
  | { kind: 'kitchenExhaust' };

export type PurifierStatus = 'none' | 'undersized' | 'adequate' | 'good';

export interface PurifierVerdict {
  status: PurifierStatus;
  requiredCadr: number;
  coverage: number;
}

export interface IndoorSummary {
  /** Daily-average indoor/outdoor ratio without indoor sources. */
  ratio: number;
  homePm25: number;
  hacks: Hack[];
  purifier: PurifierVerdict;
}

export type SwapChoice =
  | { kind: 'mode'; mode: CommuteMode }
  | { kind: 'carpool' }
  | { kind: 'wfhDays'; days: number }
  | { kind: 'cooking'; fuel: CookingFuel }
  | { kind: 'heating'; heating: Heating }
  | { kind: 'stopBurning' };

export interface Swap {
  id: string;
  ruleId: RuleId;
  title: string;
  detail: string;
  /** Savings per week (positive = less); null when not meaningful (e.g. biogenic carbon). */
  co2KgWeek: number | null;
  pm25GWeek: number;
  /** Change in the user's own inhaled dose on a commute day, percent (negative = less). */
  doseDeltaPct: number;
  tradeOff: string | null;
  choice: SwapChoice;
}

/** Where the time of day is spent, for the dose model (docs/03 E). */
export type MicroEnv = 'sleep' | 'home' | 'work' | 'commute' | 'exercise';

export interface Dose {
  totalUg: number;
  volumeM3: number;
  byPlace: Record<MicroEnv, number>;
  cigarettes: number;
}

export interface CommunityAction {
  id: string;
  ruleId: RuleId;
  title: string;
  detail: string;
}

/** What-if toggles (docs/03 "Choices"). Absent fields mean "as in the profile". */
export interface Choices {
  mode?: CommuteMode;
  /** Emissions-only swaps (no effect on the household's own dose); read by community scaling. */
  carpool?: boolean;
  wfhDays?: number;
  n95?: boolean;
  purifierCadr?: number;
  sealGaps?: boolean;
  kitchenExhaust?: boolean;
  removeSources?: readonly IndoorSource[];
  cooking?: CookingFuel;
  heating?: Heating;
  stopBurning?: boolean;
  /** Move outdoor exercise to the clean window, or indoors on bad days. */
  smartExercise?: boolean;
}

export interface Plan {
  air: AirSummary;
  tierGeneral: Tier;
  tierSensitive: Tier;
  sensitive: SensitiveGroup[];
  windows: Windows;
  routine: RoutineStep[];
  alerts: Alert[];
  indoor: IndoorSummary;
  swaps: Swap[];
  exposure: { usual: Dose; withPlan: Dose; reductionPct: number };
  community: CommunityAction[];
  choices: Choices;
}
