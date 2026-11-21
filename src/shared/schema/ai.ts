/** Contracts for the AI routes (docs/04 §3, §5). Every string is bounded and pattern-checked. */
import * as z from 'zod/mini';

import { MAX_ALERTS, MAX_COMMUTE_KM, MAX_QUESTION_CHARS } from '../limits.js';
import { AirSource } from './air.js';
import { CommuteMode, PLACE_NAME } from './profile.js';

/** Value sets shared with the engine's types (engine/types.ts derives its unions from these). */
export const SCALES = ['NAQI', 'US_AQI'] as const;
export const TRENDS = ['rising', 'falling', 'steady'] as const;
export const GRAP_STAGES = ['I', 'II', 'III', 'IV'] as const;
export const SENSITIVE_GROUPS = ['under5', 'over65', 'pregnant', 'respiratory', 'heart'] as const;

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
  scale: z.enum(SCALES),
  pm25: measure,
  index: z.int().check(z.gte(0), z.lte(500)),
  band: plainText(40),
  tier: z.int().check(z.gte(0), z.lte(5)),
  trend: z.enum(TRENDS),
  sensitive: z.array(z.enum(SENSITIVE_GROUPS)).check(z.maxLength(SENSITIVE_GROUPS.length)),
  cleanWindow: WindowSummary,
  worstWindow: WindowSummary,
  alerts: z.array(Item).check(z.maxLength(MAX_ALERTS)),
  actions: z.array(Item).check(z.maxLength(10)),
  dose: z.strictObject({
    usualUg: measure,
    planUg: measure,
    reductionPct: z.number().check(z.gte(-1000), z.lte(100)),
    cigarettesUsual: measure,
    cigarettesPlan: measure,
  }),
  commute: z.strictObject({
    mode: CommuteMode,
    km: z.number().check(z.gte(0), z.lte(MAX_COMMUTE_KM)),
  }),
  grap: z.nullable(z.enum(GRAP_STAGES)),
  source: AirSource,
});
export type AiContext = z.infer<typeof AiContext>;

export const Language = z.enum(['en', 'hi']);
export type Language = z.infer<typeof Language>;

export const BriefRequest = z.strictObject({ context: AiContext });

export const AskRequest = z.strictObject({
  question: z.string().check(z.trim(), z.minLength(1), z.maxLength(MAX_QUESTION_CHARS)),
  context: AiContext,
  language: Language,
});
export type AskRequest = z.infer<typeof AskRequest>;

/** Length limits for model output, shared by the zod schemas and the JSON schemas below. */
const OUT = { headline: 90, summary: 600, answer: 1200, followUp: 90, citations: 6, followUps: 3 };

const text = (max: number) => z.string().check(z.minLength(1), z.maxLength(max));

/** What the model must return for the daily brief. */
export const BriefOutput = z.strictObject({
  headline: text(OUT.headline),
  summary: text(OUT.summary),
});
export type BriefOutput = z.infer<typeof BriefOutput>;

/** What the model must return for a question. */
export const AnswerOutput = z.strictObject({
  answer: text(OUT.answer),
  citedRuleIds: z.array(ruleId).check(z.maxLength(OUT.citations)),
  followUps: z.array(text(OUT.followUp)).check(z.maxLength(OUT.followUps)),
});
export type AnswerOutput = z.infer<typeof AnswerOutput>;

/** Server replies, validated again in the browser before rendering. */
export const BriefReply = z.strictObject({
  ...BriefOutput.shape,
  source: z.enum(['gemini', 'rules']),
});
export type BriefResponse = z.infer<typeof BriefReply>;
export const AskReply = z.strictObject({
  ...AnswerOutput.shape,
  source: z.enum(['gemini', 'rules', 'safety']),
});
export type AskResponse = z.infer<typeof AskReply>;

/** JSON schemas handed to the model for structured output (mirrors the zod schemas). */
export const BRIEF_JSON_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', maxLength: OUT.headline },
    summary: { type: 'string', maxLength: OUT.summary },
  },
  required: ['headline', 'summary'],
} as const;

export const ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', maxLength: OUT.answer },
    citedRuleIds: { type: 'array', items: { type: 'string' }, maxItems: OUT.citations },
    followUps: {
      type: 'array',
      items: { type: 'string', maxLength: OUT.followUp },
      maxItems: OUT.followUps,
    },
  },
  required: ['answer', 'citedRuleIds', 'followUps'],
} as const;
