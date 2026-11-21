/**
 * Daily brief and Ask Smogwise (docs/04 §6 guardrails, §8 implementations). Two implementations of one interface, chosen once at
 * start-up: the rules service (no API key) and the Gemini service. The Gemini service runs every
 * model call through one guarded pipeline: model → zod → number check → accept, else fall back.
 */
import { createHash } from 'node:crypto';

import { composeBrief } from '../../shared/ai/fallback.js';
import { rulesAnswer } from '../../shared/ai/rules.js';
import {
  isRedFlag,
  safetyAnswer,
  sanitiseQuestion,
  unknownNumbers,
} from '../../shared/ai/safety.js';
import {
  ANSWER_JSON_SCHEMA,
  AnswerOutput,
  BRIEF_JSON_SCHEMA,
  BriefOutput,
  type AiContext,
  type AskRequest,
  type AskResponse,
  type BriefResponse,
} from '../../shared/schema/ai.js';
import { TtlCache } from '../cache.js';
import type { Logger } from '../logger.js';
import type { AiClient } from './client.js';
import { askPrompt, briefPrompt, systemPrompt } from './prompts.js';
import type * as z from 'zod/mini';

const BRIEF_TOKENS = 300;
const ANSWER_TOKENS = 500;
const BRIEF_TTL_MS = 15 * 60_000;
const ANSWER_TTL_MS = 10 * 60_000;

export interface AiService {
  brief(context: AiContext): Promise<BriefResponse>;
  ask(request: AskRequest): Promise<AskResponse>;
}

/** Answers from the plan's rules only; used when no model is configured. */
export const rulesService: AiService = {
  brief: (context) => Promise.resolve(composeBrief(context)),
  ask: (request) =>
    Promise.resolve(rulesAnswer(request.question, request.context, request.language)),
};

interface GeminiServiceDeps {
  ai: AiClient;
  logger: Logger;
  timeoutMs: number;
  maxEntries: number;
  now?: () => number;
}

interface GuardedCall<T, R> {
  route: 'brief' | 'ask';
  system: string;
  prompt: string;
  jsonSchema: object;
  maxOutputTokens: number;
  output: z.ZodMiniType<T>;
  /** Text whose numbers must all appear in the context. */
  textOf: (value: T) => string;
  context: AiContext;
  accept: (value: T) => R;
  fallback: () => R;
}

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** One model call with every guardrail; logs only the reason when output is not used. */
async function guarded<T, R>(deps: GeminiServiceDeps, call: GuardedCall<T, R>): Promise<R> {
  const reject = (reason: string): R => {
    deps.logger.log('warn', 'ai_fallback', { route: call.route, reason });
    return call.fallback();
  };
  try {
    const raw = await deps.ai.generateJson({
      system: call.system,
      prompt: call.prompt,
      schema: call.jsonSchema,
      maxOutputTokens: call.maxOutputTokens,
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    const parsed = call.output.safeParse(raw);
    if (!parsed.success) {
      return reject('schema');
    }
    if (unknownNumbers(call.textOf(parsed.data), call.context).length > 0) {
      return reject('unknown_number');
    }
    return call.accept(parsed.data);
  } catch (error) {
    return reject(error instanceof Error ? error.name : 'unknown');
  }
}

/** Rule ids the context mentions; the model may only cite these. */
const knownIds = (context: AiContext): Set<string> =>
  new Set([...context.actions, ...context.alerts].map((item) => item.id));

/** The brief: Gemini writes the headline and summary from the plan summary. */
function briefCall(context: AiContext): GuardedCall<BriefOutput, BriefResponse> {
  return {
    route: 'brief',
    system: systemPrompt('en'),
    prompt: briefPrompt(context),
    jsonSchema: BRIEF_JSON_SCHEMA,
    maxOutputTokens: BRIEF_TOKENS,
    output: BriefOutput,
    textOf: (value) => `${value.headline} ${value.summary}`,
    context,
    accept: (value) => ({ ...value, source: 'gemini' }),
    fallback: () => composeBrief(context),
  };
}

/** A question: Gemini answers from the plan; cited rule ids are filtered to known ones. */
function answerCall(request: AskRequest, question: string): GuardedCall<AnswerOutput, AskResponse> {
  const known = knownIds(request.context);
  return {
    route: 'ask',
    system: systemPrompt(request.language),
    prompt: askPrompt(request.context, question),
    jsonSchema: ANSWER_JSON_SCHEMA,
    maxOutputTokens: ANSWER_TOKENS,
    output: AnswerOutput,
    textOf: (value) => value.answer,
    context: request.context,
    accept: (value) => ({
      ...value,
      citedRuleIds: value.citedRuleIds.filter((id) => known.has(id)),
      source: 'gemini',
    }),
    fallback: () => rulesAnswer(question, request.context, request.language),
  };
}

/** Gemini-backed service with caches; model answers are cached, fallbacks are not (retried). */
export function createGeminiService(deps: GeminiServiceDeps): AiService {
  const briefs = new TtlCache<BriefResponse>(deps.maxEntries, BRIEF_TTL_MS, deps.now);
  const answers = new TtlCache<AskResponse>(deps.maxEntries, ANSWER_TTL_MS, deps.now);
  const cacheable = (value: { source: string }): boolean => value.source === 'gemini';

  return {
    brief: (context) =>
      briefs.load(hash(context), () => guarded(deps, briefCall(context)), cacheable),
    ask(request) {
      // Red flags never reach the model.
      if (isRedFlag(request.question)) {
        return Promise.resolve(safetyAnswer(request.language));
      }
      const question = sanitiseQuestion(request.question);
      const key = hash([request.language, question, request.context]);
      return answers.load(key, () => guarded(deps, answerCall(request, question)), cacheable);
    },
  };
}
