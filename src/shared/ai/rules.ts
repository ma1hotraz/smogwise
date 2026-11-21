/**
 * The deterministic assistant: the same answers on the server (no API key, or a model failure)
 * and in the browser (server unreachable). Red flags always win.
 */
import type { AiContext, AskResponse, Language } from '../schema/ai.js';
import { answerByIntent } from './fallback.js';
import { isRedFlag, safetyAnswer, sanitiseQuestion } from './safety.js';

/** Safety answer for red-flag symptoms, otherwise the intent-matched plan answer. */
export function rulesAnswer(question: string, context: AiContext, language: Language): AskResponse {
  return isRedFlag(question)
    ? safetyAnswer(language)
    : answerByIntent(sanitiseQuestion(question), context, language);
}
