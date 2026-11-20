/**
 * Exposure, indoor and emission constants (docs/03 I, E, S). Rounded published averages; the
 * results are estimates for comparing choices.
 */
import type { CommuteMode, CookingFuel, Heating, IndoorSource } from '../../schema/profile.js';

export interface ModeFactor {
  label: string;
  speedKmh: number;
  /** Breathing rate while travelling, m³/h. */
  rate: number;
  /** In-transit concentration relative to ambient. */
  ratio: number;
  /** kg CO₂ and g PM2.5 per passenger-km. */
  co2: number;
  pm25: number;
  /** Open to traffic air: masks and route choice matter. */
  exposed: boolean;
}

/**
 * Sources: India GHG Program road transport factors (2015); CEA CO₂ database v19 (0.71 kg/kWh
 * × 0.13 kWh/km for EV); EMEP/EEA Guidebook 2023 (exhaust + non-exhaust PM2.5); in-vehicle
 * ratios from Goel et al. 2015 (Delhi) and de Nazelle et al. 2017; EPA Exposure Factors 2011.
 */
export const MODES: Record<CommuteMode, ModeFactor> = {
  walk: { label: 'Walk', speedKmh: 5, rate: 1.3, ratio: 1.3, co2: 0, pm25: 0, exposed: true },
  cycle: { label: 'Cycle', speedKmh: 14, rate: 1.8, ratio: 1.3, co2: 0, pm25: 0, exposed: true },
  two_wheeler: {
    label: 'Two-wheeler',
    speedKmh: 25,
    rate: 0.6,
    ratio: 1.5,
    co2: 0.035,
    pm25: 0.02,
    exposed: true,
  },
  auto: {
    label: 'Auto-rickshaw',
    speedKmh: 20,
    rate: 0.5,
    ratio: 1.5,
    co2: 0.055,
    pm25: 0.01,
    exposed: true,
  },
  bus: { label: 'Bus', speedKmh: 15, rate: 0.5, ratio: 1.2, co2: 0.02, pm25: 0.002, exposed: true },
  metro: {
    label: 'Metro',
    speedKmh: 30,
    rate: 0.6,
    ratio: 0.7,
    co2: 0.012,
    pm25: 0.0005,
    exposed: false,
  },
  petrol_car: {
    label: 'Petrol car',
    speedKmh: 22,
    rate: 0.45,
    ratio: 0.7,
    co2: 0.14,
    pm25: 0.012,
    exposed: false,
  },
  diesel_car: {
    label: 'Diesel car',
    speedKmh: 22,
    rate: 0.45,
    ratio: 0.7,
    co2: 0.15,
    pm25: 0.02,
    exposed: false,
  },
  cng_car: {
    label: 'CNG car',
    speedKmh: 22,
    rate: 0.45,
    ratio: 0.7,
    co2: 0.11,
    pm25: 0.01,
    exposed: false,
  },
  ev: { label: 'EV', speedKmh: 22, rate: 0.45, ratio: 0.7, co2: 0.09, pm25: 0.008, exposed: false },
  wfh: {
    label: 'Work from home',
    speedKmh: 1,
    rate: 0,
    ratio: 0,
    co2: 0,
    pm25: 0,
    exposed: false,
  },
};

export const CAR_MODES: readonly CommuteMode[] = ['petrol_car', 'diesel_car', 'cng_car', 'ev'];

/** Breathing rates, m³/h (EPA Exposure Factors Handbook 2011, ch. 6, adult means rounded). */
export const RATE = { sleep: 0.3, rest: 0.45, exercise: 2.5 } as const;

/** Typical day (docs/03 E). */
export const DAY = {
  sleepStart: 23,
  sleepHours: 8,
  workHours: 8,
  /** Second commute leg starts this many hours after departure. */
  returnAfter: 9,
  /** Indoor workplace / school concentration relative to ambient. */
  workRatio: 0.6,
} as const;

/** N95 real-world factor: 70 % reduction (conservative vs. 95 % lab filtration). */
export const N95_FACTOR = 0.3;

/** Indoor mass-balance constants (Chen & Zhao 2011 review). */
export const INDOOR = {
  penetration: 0.8,
  deposition: 0.2,
  ceilingM: 2.7,
  purifierDerate: 0.8,
  targetAch: 5,
  diyCadr: 300,
  referenceVolume: 40,
  referenceAch: 0.5,
  sealFactor: 0.6,
  minAch: 0.3,
} as const;

export const AIR_EXCHANGE = { leaky: 1.0, average: 0.5, sealed: 0.3 } as const;

/** Daily-average µg/m³ each source adds in the 40 m³ reference room (docs/03 I). */
export const SOURCE_DELTA: Record<IndoorSource, number> = {
  smoking: 40,
  incense: 25,
  mosquitoCoil: 50,
  candles: 5,
  drySweeping: 5,
};

export const COOKING_DELTA: Record<CookingFuel | 'lpgExhaust', number> = {
  biomass: 150,
  lpg: 10,
  lpgExhaust: 3,
  induction: 3,
};

/** Heating that burns fuel indoors: smoke plus carbon-monoxide risk (AL01, R07, S08). */
export function burnsFuelIndoors(heating: Heating): boolean {
  return heating === 'brazier' || heating === 'wood' || heating === 'kerosene';
}

export const HEATING_DELTA: Record<Heating, number> = {
  none: 0,
  electric: 0,
  brazier: 50,
  wood: 60,
  kerosene: 30,
};

/** Weekly fuel figures (docs/03 S): 3 h of heating per evening; null CO₂ = biogenic, noted. */
export const HEATING_WEEK = {
  none: { co2: 0, pm25: 0 },
  electric: { co2: 22, pm25: 0 },
  brazier: { co2: 21, pm25: 14 },
  wood: { co2: null, pm25: 84 },
  kerosene: { co2: 7, pm25: 1 },
} as const satisfies Record<Heating, { co2: number | null; pm25: number }>;

export const COOKING_WEEK = {
  biomass: { co2: null, pm25: 168 },
  lpg: { co2: 7, pm25: 0.1 },
  induction: { co2: 9, pm25: 0 },
} as const satisfies Record<CookingFuel, { co2: number | null; pm25: number }>;

/** 2 kg/week of burnt waste × 9.8 g PM2.5/kg (Wiedinmyer et al. 2014). */
export const WASTE_BURNING_PM25_G_WEEK = 20;

/** Weeks per month for community scaling, and kg CO₂ one tree takes up per year (approx.). */
export const WEEKS_PER_MONTH = 4.35;
export const TREE_KG_CO2_YEAR = 21;
