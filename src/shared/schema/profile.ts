/**
 * Household and lifestyle profile (docs/01 §4 F1). Validated on every load from storage, so a
 * tampered or outdated value is discarded instead of reaching the engine.
 */
import * as z from 'zod/mini';
import { MAX_CADR } from '../limits.js';

const count = (max: number) => z.int().check(z.gte(0), z.lte(max));
const hour = z.int().check(z.gte(0), z.lte(23));

export const COMMUTE_MODES = [
  'walk',
  'cycle',
  'two_wheeler',
  'auto',
  'bus',
  'metro',
  'petrol_car',
  'diesel_car',
  'cng_car',
  'ev',
  'wfh',
] as const;
export const CommuteMode = z.enum(COMMUTE_MODES);
export type CommuteMode = z.infer<typeof CommuteMode>;

export const COOKING_FUELS = ['lpg', 'induction', 'biomass'] as const;
export const CookingFuel = z.enum(COOKING_FUELS);
export type CookingFuel = z.infer<typeof CookingFuel>;

export const HEATING_TYPES = ['none', 'electric', 'brazier', 'wood', 'kerosene'] as const;
export const Heating = z.enum(HEATING_TYPES);
export type Heating = z.infer<typeof Heating>;

export const TIGHTNESS = ['leaky', 'average', 'sealed'] as const;
export const Tightness = z.enum(TIGHTNESS);
export type Tightness = z.infer<typeof Tightness>;

export const INDOOR_SOURCES = [
  'smoking',
  'incense',
  'mosquitoCoil',
  'candles',
  'drySweeping',
] as const;
export type IndoorSource = (typeof INDOOR_SOURCES)[number];

/** A home with none of the indoor sources: the default for new profiles and samples. */
export const NO_INDOOR_SOURCES: Record<IndoorSource, false> = {
  smoking: false,
  incense: false,
  mosquitoCoil: false,
  candles: false,
  drySweeping: false,
};

/** Place names allow any script (Devanagari, Urdu, Han…) plus common punctuation. */
export const PLACE_NAME = /^[\p{L}\p{M}\p{N} .,'()-]{1,80}$/u;

export const Location = z.strictObject({
  name: z.string().check(z.regex(PLACE_NAME)),
  admin1: z.optional(z.string().check(z.regex(PLACE_NAME))),
  countryCode: z.string().check(z.regex(/^[A-Z]{2}$/)),
  lat: z.number().check(z.gte(-90), z.lte(90)),
  lon: z.number().check(z.gte(-180), z.lte(180)),
  timezone: z.string().check(z.regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/)),
});
export type Location = z.infer<typeof Location>;

export const Household = z.strictObject({
  adults: count(12),
  under5: count(8),
  children: count(10),
  over65: count(8),
  pregnant: z.boolean(),
  respiratory: z.boolean(),
  heart: z.boolean(),
});
export type Household = z.infer<typeof Household>;

export const Lifestyle = z.strictObject({
  commute: z.strictObject({
    mode: CommuteMode,
    km: z.number().check(z.gte(0), z.lte(80)),
    daysPerWeek: count(7),
    departHour: hour,
  }),
  exercise: z.strictObject({
    kind: z.enum(['none', 'outdoor', 'indoor']),
    hour,
    minutes: z.int().check(z.gte(0), z.lte(180)),
  }),
  cooking: CookingFuel,
  heating: Heating,
  home: z.strictObject({
    tightness: Tightness,
    roomM2: z.number().check(z.gte(6), z.lte(100)),
    purifierCadr: z.number().check(z.gte(0), z.lte(MAX_CADR)),
  }),
  sources: z.strictObject({
    smoking: z.boolean(),
    incense: z.boolean(),
    mosquitoCoil: z.boolean(),
    candles: z.boolean(),
    drySweeping: z.boolean(),
  }),
  burnsWaste: z.boolean(),
});
export type Lifestyle = z.infer<typeof Lifestyle>;

export const Profile = z.strictObject({
  version: z.literal(1),
  location: Location,
  household: Household,
  lifestyle: Lifestyle,
});
export type Profile = z.infer<typeof Profile>;
