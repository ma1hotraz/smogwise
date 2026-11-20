/** Contracts for the AI routes (docs/04 §3, §5). Every string is bounded and pattern-checked. */
import * as z from 'zod/mini';

import { AirSource } from './air.js';
import { CommuteMode, PLACE_NAME } from './profile.js';

const RULE_ID = /^(?:A|L|H|E|R|S|C|AL)\d{2}$/;
const ruleId = z.string().check(z.regex(RULE_ID));
/** Short engine-written text: letters, digits and everyday punctuation only (no markup). */
const plainText = (max: number) =>
  z
    .string()
    .check(z.regex(new RegExp(`^[\\p{L}\\p{M}\\p{N} .,;:'’()–\\-/%&+µ³₂?!"]{1,${max}}$`, 'u')));
const hhmm = z.string().check(z.regex(/^\d{2}:00$/));
const measure = z.number().check(z.gte(0), z.lte(100_000));

const WindowSummary = z.nullable(z.strictObject({ start: hhmm, end: hhmm, pm25: measure }));
const Item = z.strictObject({ id: ruleId, title: plainText(90) });

export const AiContext = z.strictObject({
  city: z.string().check(z.regex(PLACE_NAME)),
  country: z.string().check(z.regex(/^[A-Z]{2}$/)),
  scale: z.enum(['NAQI', 'US_AQI']),
  pm25: measure,
  index: z.int().check(z.gte(0), z.lte(500)),
  band: plainText(40),
  tier: z.int().check(z.gte(0), z.lte(5)),
  trend: z.enum(['rising', 'falling', 'steady']),
  sensitive: z
    .array(z.enum(['under5', 'over65', 'pregnant', 'respiratory', 'heart']))
    .check(z.maxLength(5)),
  cleanWindow: WindowSummary,
  worstWindow: WindowSummary,
  alerts: z.array(Item).check(z.maxLength(6)),
  actions: z.array(Item).check(z.maxLength(10)),
  dose: z.strictObject({
    usualUg: measure,
    planUg: measure,
    reductionPct: z.number().check(z.gte(-1000), z.lte(100)),
    cigarettesUsual: measure,
    cigarettesPlan: measure,
  }),
  commute: z.strictObject({ mode: CommuteMode, km: z.number().check(z.gte(0), z.lte(80)) }),
  grap: z.nullable(z.enum(['I', 'II', 'III', 'IV'])),
  source: AirSource,
});
export type AiContext = z.infer<typeof AiContext>;

export const Language = z.enum(['en', 'hi']);
export type Language = z.infer<typeof Language>;

export const BriefRequest = z.strictObject({ context: AiContext });

export const AskRequest = z.strictObject({
  question: z.string().check(z.trim(), z.minLength(1), z.maxLength(400)),
  context: AiContext,
  language: Language,
});
export type AskRequest = z.infer<typeof AskRequest>;

const text = (max: number) => z.string().check(z.minLength(1), z.maxLength(max));

/** What the model must return for the daily brief. */
export const BriefOutput = z.object({ headline: text(90), summary: text(600) });
export type BriefOutput = z.infer<typeof BriefOutput>;

/** What the model must return for a question. */
export const AnswerOutput = z.object({
  answer: text(1200),
  citedRuleIds: z.array(ruleId).check(z.maxLength(6)),
  followUps: z.array(text(90)).check(z.maxLength(3)),
});
export type AnswerOutput = z.infer<typeof AnswerOutput>;

/** Server replies, validated again in the browser before rendering. */
export const BriefReply = z.object({ ...BriefOutput.shape, source: z.enum(['gemini', 'rules']) });
export type BriefResponse = z.infer<typeof BriefReply>;
export const AskReply = z.object({
  ...AnswerOutput.shape,
  source: z.enum(['gemini', 'rules', 'safety']),
});
export type AskResponse = z.infer<typeof AskReply>;

/** JSON schemas handed to the model for structured output (mirrors the zod schemas). */
export const BRIEF_JSON_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', maxLength: 90 },
    summary: { type: 'string', maxLength: 600 },
  },
  required: ['headline', 'summary'],
} as const;

export const ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', maxLength: 1200 },
    citedRuleIds: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    followUps: { type: 'array', items: { type: 'string', maxLength: 90 }, maxItems: 3 },
  },
  required: ['answer', 'citedRuleIds', 'followUps'],
} as const;
