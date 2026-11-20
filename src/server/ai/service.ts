/**
 * Daily brief and Ask Smogwise (docs/04 §6). Order of guardrails: red-flag check → sanitise →
 * cache → model → zod → number check → rule-id filter; any failure falls back to rules.
 */
import { createHash } from 'node:crypto';

import { answerByIntent, composeBrief } from '../../shared/ai/fallback.js';
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

const BRIEF_TOKENS = 300;
const ANSWER_TOKENS = 500;
const BRIEF_TTL_MS = 15 * 60_000;
const ANSWER_TTL_MS = 10 * 60_000;

export interface AiServiceDeps {
  ai: AiClient;
  logger: Logger;
  timeoutMs: number;
  maxEntries: number;
  now?: () => number;
}

export interface AiService {
  brief(context: AiContext): Promise<BriefResponse>;
  ask(request: AskRequest): Promise<AskResponse>;
}

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Logs why the model's output was not used — by reason only, never with content. */
function rejected(deps: AiServiceDeps, route: string, reason: string): void {
  deps.logger.log('warn', 'ai_fallback', { route, reason });
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.name : 'unknown');

async function generateBrief(deps: AiServiceDeps, context: AiContext): Promise<BriefResponse> {
  try {
    const raw = await deps.ai.generateJson({
      system: systemPrompt('en'),
      prompt: briefPrompt(context),
      schema: BRIEF_JSON_SCHEMA,
      maxOutputTokens: BRIEF_TOKENS,
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    const parsed = BriefOutput.safeParse(raw);
    if (!parsed.success) {
      rejected(deps, 'brief', 'schema');
      return composeBrief(context);
    }
    if (unknownNumbers(`${parsed.data.headline} ${parsed.data.summary}`, context).length > 0) {
      rejected(deps, 'brief', 'unknown_number');
      return composeBrief(context);
    }
    return { ...parsed.data, source: 'gemini' };
  } catch (error) {
    rejected(deps, 'brief', reasonOf(error));
    return composeBrief(context);
  }
}

async function generateAnswer(
  deps: AiServiceDeps,
  request: AskRequest,
  question: string,
): Promise<AskResponse> {
  const fallback = answerByIntent(question, request.context, request.language);
  try {
    const raw = await deps.ai.generateJson({
      system: systemPrompt(request.language),
      prompt: askPrompt(request.context, question),
      schema: ANSWER_JSON_SCHEMA,
      maxOutputTokens: ANSWER_TOKENS,
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    const parsed = AnswerOutput.safeParse(raw);
    if (!parsed.success) {
      rejected(deps, 'ask', 'schema');
      return fallback;
    }
    if (unknownNumbers(parsed.data.answer, request.context).length > 0) {
      rejected(deps, 'ask', 'unknown_number');
      return fallback;
    }
    const known = new Set([...request.context.actions, ...request.context.alerts].map((i) => i.id));
    const citedRuleIds = parsed.data.citedRuleIds.filter((id) => known.has(id));
    return { ...parsed.data, citedRuleIds, source: 'gemini' };
  } catch (error) {
    rejected(deps, 'ask', reasonOf(error));
    return fallback;
  }
}

/** Creates the service with caches; with AI disabled it answers from rules directly. */
export function createAiService(deps: AiServiceDeps): AiService {
  const briefs = new TtlCache<BriefResponse>(deps.maxEntries, BRIEF_TTL_MS, deps.now);
  const answers = new TtlCache<AskResponse>(deps.maxEntries, ANSWER_TTL_MS, deps.now);
  // Model answers are cached; a rules answer after a model failure is not, so it is retried.
  const cacheable = (value: { source: string }): boolean => value.source === 'gemini';
  return {
    brief(context) {
      if (!deps.ai.enabled) {
        return Promise.resolve(composeBrief(context));
      }
      return briefs.load(hash(context), () => generateBrief(deps, context), cacheable);
    },
    ask(request) {
      if (isRedFlag(request.question)) {
        return Promise.resolve(safetyAnswer(request.language));
      }
      const question = sanitiseQuestion(request.question);
      if (!deps.ai.enabled) {
        return Promise.resolve(answerByIntent(question, request.context, request.language));
      }
      const key = hash([request.language, question, request.context]);
      return answers.load(key, () => generateAnswer(deps, request, question), cacheable);
    },
  };
}
