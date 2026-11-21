/**
 * Deterministic answers when the model is unavailable (docs/04 §7). Used by the server and, if
 * the server is unreachable, by the browser — so Ask Smogwise always answers from the plan.
 */
import { TIER } from '../engine/data/scales.js';
import type { RuleId } from '../engine/types.js';
import type { AiContext, AskResponse, BriefResponse, Language } from '../schema/ai.js';

type Intent =
  'exercise' | 'children' | 'mask' | 'purifier' | 'windows' | 'commute' | 'heating' | 'general';

const KEYWORDS: Record<Exclude<Intent, 'general'>, readonly string[]> = {
  exercise: [
    'run',
    'jog',
    'walk',
    'exercise',
    'workout',
    'yoga',
    'gym',
    'sport',
    'cycle ride',
    'daud',
    'kasrat',
    'टहल',
    'व्यायाम',
    'दौड़',
  ],
  children: ['child', 'kid', 'baby', 'toddler', 'school', 'play', 'bachch', 'बच्च', 'स्कूल'],
  mask: ['mask', 'n95', 'kn95', 'ffp2', 'मास्क'],
  purifier: ['purifier', 'filter', 'hepa', 'cadr', 'प्यूरीफायर'],
  windows: ['window', 'ventilat', 'air out', 'fresh air', 'khidki', 'खिड़की'],
  commute: [
    'commute',
    'office',
    'metro',
    'bus',
    'scooter',
    'bike',
    'car',
    'drive',
    'travel',
    'दफ्तर',
    'मेट्रो',
  ],
  heating: [
    'heater',
    'heating',
    'angithi',
    'brazier',
    'coal',
    'wood',
    'kerosene',
    'cold',
    'अंगीठी',
    'हीटर',
  ],
};

/** First intent whose keywords appear in the question; `general` otherwise. */
export function detectIntent(question: string): Intent {
  const text = question.toLowerCase();
  const found = (Object.keys(KEYWORDS) as (keyof typeof KEYWORDS)[]).find((intent) =>
    KEYWORDS[intent].some((word) => text.includes(word)),
  );
  return found ?? 'general';
}

const RULES: Record<Intent, readonly RuleId[]> = {
  exercise: ['R03', 'A04'],
  children: ['R05', 'A03'],
  mask: ['R04'],
  purifier: ['H01', 'R08'],
  windows: ['R01', 'R02'],
  commute: ['R04', 'S03'],
  heating: ['AL01', 'S08'],
  general: ['A03', 'A04'],
};

type WindowSummary = NonNullable<AiContext['cleanWindow']>;

/** Clean-window sentences per language: with a window, and when none is left today. */
const WINDOW_TEXT: Record<Language, { some: (w: WindowSummary) => string; none: string }> = {
  en: {
    some: (w) => `The cleanest time today is ${w.start}–${w.end}, at about ${w.pm25} µg/m³.`,
    none: 'There is no cleaner window left today.',
  },
  hi: {
    some: (w) => `आज सबसे साफ़ समय ${w.start}–${w.end} है (लगभग ${w.pm25} µg/m³)।`,
    none: 'आज बाकी दिन में कोई साफ़ समय नहीं बचा है।',
  },
};

function windowText(ctx: AiContext, language: Language): string {
  const text = WINDOW_TEXT[language];
  return ctx.cleanWindow ? text.some(ctx.cleanWindow) : text.none;
}

/** Stricter advice from the "unhealthy" tier upwards. */
const STRICT_FROM_TIER = TIER.unhealthy;

function bodyEn(intent: Intent, ctx: AiContext): string {
  const bad = ctx.tier >= STRICT_FROM_TIER;
  const lines: Record<Intent, string> = {
    exercise: bad
      ? 'Move exercise indoors today: yoga, stairs or a home circuit. Hard breathing outside pulls smog deep into the lungs.'
      : 'Outdoor exercise is reasonable; keep it in the cleanest hours.',
    children: bad
      ? 'Keep children indoors for play today and ask the school to move sport inside.'
      : 'Short outdoor play is fine, best in the clean window.',
    mask: bad
      ? 'Yes — wear a well-fitted N95 or FFP2 outside. Cloth and surgical masks do little against PM2.5.'
      : 'A mask is optional today; an N95 helps on busy roads.',
    purifier:
      'Run a HEPA purifier in the room you use most, doors and windows shut, and on high for 30 minutes before sleep. Check the Home air tab for the size your room needs.',
    windows: bad
      ? 'Keep windows shut except a short airing burst in the clean window.'
      : 'You can air the home freely today.',
    commute: bad
      ? 'Prefer the metro or a closed car on recirculate; on a two-wheeler, walking or cycling, wear an N95.'
      : 'Commute as usual, on quieter streets where you can.',
    heating:
      'Never sleep with a brazier, wood or kerosene heater burning in a closed room — carbon monoxide can kill. An electric or oil-filled radiator is safer indoors.',
    general: `Air in ${ctx.city} is ${ctx.band} (PM2.5 ${ctx.pm25} µg/m³).`,
  };
  return lines[intent];
}

function bodyHi(intent: Intent, ctx: AiContext): string {
  const bad = ctx.tier >= STRICT_FROM_TIER;
  const lines: Record<Intent, string> = {
    exercise: bad
      ? 'आज व्यायाम घर के अंदर करें — योग, सीढ़ियाँ या घर पर कसरत।'
      : 'बाहर व्यायाम ठीक है, साफ़ समय में करें।',
    children: bad
      ? 'आज बच्चों को घर के अंदर खिलाएँ और स्कूल से खेल अंदर कराने को कहें।'
      : 'थोड़ी देर बाहर खेलना ठीक है, साफ़ समय में।',
    mask: bad
      ? 'हाँ — बाहर अच्छी फिटिंग वाला N95 मास्क पहनें। कपड़े या सर्जिकल मास्क PM2.5 से नहीं बचाते।'
      : 'आज मास्क ज़रूरी नहीं, पर व्यस्त सड़कों पर N95 मदद करता है।',
    purifier: 'जिस कमरे में सबसे ज़्यादा रहते हैं वहाँ HEPA प्यूरीफायर चलाएँ, दरवाज़े-खिड़कियाँ बंद रखें।',
    windows: bad ? 'खिड़कियाँ बंद रखें, बस साफ़ समय में थोड़ी देर हवा आने दें।' : 'आज घर में खुलकर हवा आने दें।',
    commute: bad
      ? 'मेट्रो या बंद कार चुनें; दोपहिया, पैदल या साइकिल पर N95 पहनें।'
      : 'सामान्य रूप से जाएँ, हो सके तो शांत सड़कों से।',
    heating: 'बंद कमरे में अंगीठी, लकड़ी या केरोसिन हीटर जलाकर कभी न सोएँ — कार्बन मोनोऑक्साइड जानलेवा है।',
    general: `${ctx.city} में हवा ${ctx.band} है (PM2.5 ${ctx.pm25} µg/m³)।`,
  };
  return lines[intent];
}

/** Answer bodies per language: adding a language is one entry. */
const BODIES: Record<Language, (intent: Intent, ctx: AiContext) => string> = {
  en: bodyEn,
  hi: bodyHi,
};

const FOLLOW_UPS: Record<Language, readonly string[]> = {
  en: ['When is the air cleanest today?', 'Do I need a mask?', 'Is my purifier big enough?'],
  hi: ['आज हवा कब सबसे साफ़ है?', 'क्या मुझे मास्क चाहिए?', 'क्या मेरा प्यूरीफायर काफ़ी है?'],
};

/** Engine-backed answer chosen by keyword intent. */
export function answerByIntent(question: string, ctx: AiContext, language: Language): AskResponse {
  const intent = detectIntent(question);
  const body = BODIES[language](intent, ctx);
  return {
    answer: `${body} ${windowText(ctx, language)}`,
    citedRuleIds: [...RULES[intent]],
    followUps: [...FOLLOW_UPS[language]],
    source: 'rules',
  };
}

const TIER_ADVICE = [
  'air the home and go out freely',
  'a good day for most plans',
  'go easy outdoors',
  'limit time outdoors',
  'stay in where you can',
  'stay indoors',
];

/** Deterministic daily brief from the context. */
export function composeBrief(ctx: AiContext): BriefResponse {
  const scale = ctx.scale === 'NAQI' ? 'India AQI' : 'US AQI';
  const window = ctx.cleanWindow
    ? ` The cleanest stretch is ${ctx.cleanWindow.start}–${ctx.cleanWindow.end}.`
    : '';
  const impact =
    ctx.dose.reductionPct > 0
      ? ` Following today's plan cuts what you breathe in by about ${ctx.dose.reductionPct}% — from ${ctx.dose.cigarettesUsual} to ${ctx.dose.cigarettesPlan} cigarettes' worth.`
      : '';
  return {
    headline: `${ctx.band} air in ${ctx.city}: ${TIER_ADVICE[ctx.tier] ?? 'stay indoors'}`,
    summary: `PM2.5 is ${ctx.pm25} µg/m³ (${scale} ${ctx.index}) and ${ctx.trend}.${window}${impact}`,
    source: 'rules',
  };
}
