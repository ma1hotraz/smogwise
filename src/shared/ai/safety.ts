/**
 * Deterministic safety layer for Ask Smogwise (docs/04 §6): red-flag symptoms are answered without
 * a model, questions are sanitised, and model text is checked for invented numbers.
 */
import type { AiContext, AskResponse, Language } from '../schema/ai.js';
import { MAX_QUESTION_CHARS } from '../limits.js';

const RED_FLAGS = [
  'chest pain',
  'chest tightness',
  "can't breathe",
  'cant breathe',
  'cannot breathe',
  'struggling to breathe',
  'breathless at rest',
  'short of breath at rest',
  'blue lips',
  'lips turning blue',
  'lips are blue',
  'fainted',
  'fainting',
  'passed out',
  'unconscious',
  'seizure',
  'coughing blood',
  'confused',
  'saans nahi',
  'sans nahi',
  'seene mein dard',
  'chhati mein dard',
  'behosh',
  'साँस नहीं',
  'सांस नहीं',
  'सीने में दर्द',
  'छाती में दर्द',
  'बेहोश',
];

/** True when the question describes symptoms that need urgent care. */
export function isRedFlag(question: string): boolean {
  const text = question.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
  return RED_FLAGS.some((flag) => text.includes(flag));
}

const SAFETY_TEXT: Record<Language, string> = {
  en: 'This could be a medical emergency. Call your local emergency number now (112 in India, 1122 in Punjab, Pakistan, 120 in China) or go to the nearest hospital. If a reliever inhaler has been prescribed, use it exactly as your doctor told you. While you wait, stay in the cleanest indoor air you can, sitting upright.',
  hi: 'यह आपातकाल हो सकता है। तुरंत अपने स्थानीय आपातकालीन नंबर पर कॉल करें (भारत में 112) या नज़दीकी अस्पताल जाएँ। अगर डॉक्टर ने रिलीवर इनहेलर दिया है, तो उसे डॉक्टर के बताए अनुसार ही लें। इंतज़ार करते समय सबसे साफ़ हवा वाले कमरे में सीधे बैठें।',
};

/** The fixed emergency answer. */
export function safetyAnswer(language: Language): AskResponse {
  return { answer: SAFETY_TEXT[language], citedRuleIds: [], followUps: [], source: 'safety' };
}

/** Control (Cc) and format characters such as zero-width and bidi overrides (Cf), line separators. */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Strips control and zero-width characters, neutralises prompt delimiters, collapses space. */
export function sanitiseQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .replace(INVISIBLE, ' ')
    .replace(/<{3,}|>{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUESTION_CHARS);
}

/** Numbers any answer may use without them appearing in the context (N95, PM2.5, emergency lines…). */
const ALWAYS_ALLOWED = new Set(['95', '2.5', '10', '70', '112', '1122', '120', '24', '30', '60']);
const SMALL_COUNT = 12;

/** Numbers in `text` that appear nowhere in the context — a sign of a hallucinated figure. */
export function unknownNumbers(text: string, context: AiContext): string[] {
  const known = new Set(JSON.stringify(context).match(/\d+(?:\.\d+)?/g) ?? []);
  const found = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return found.filter((n) => !known.has(n) && !ALWAYS_ALLOWED.has(n) && Number(n) > SMALL_COUNT);
}
