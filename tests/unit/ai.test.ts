import { describe, expect, it } from 'vitest';

import { buildContext } from '../../src/shared/ai/context.js';
import { answerByIntent, composeBrief, detectIntent } from '../../src/shared/ai/fallback.js';
import {
  isRedFlag,
  safetyAnswer,
  sanitiseQuestion,
  unknownNumbers,
} from '../../src/shared/ai/safety.js';
import { buildPlan } from '../../src/shared/engine/plan.js';
import { AiContext } from '../../src/shared/schema/ai.js';
import { askPrompt, briefPrompt, systemPrompt } from '../../src/server/ai/prompts.js';
import { flatAir, NOW, sample, winterAir } from '../helpers/fixtures.js';
import { sharmaContext } from '../helpers/fakes.js';

const ctx = sharmaContext();

describe('buildContext', () => {
  it('produces a valid context with no coordinates', () => {
    expect(AiContext.safeParse(ctx).success).toBe(true);
    const text = JSON.stringify(ctx);
    expect(text).not.toContain('28.7');
    expect(text).not.toContain('77.2');
    expect(ctx).toMatchObject({
      city: 'Delhi',
      scale: 'NAQI',
      tier: 3,
      grap: 'I',
      commute: { mode: 'two_wheeler', km: 12 },
    });
    expect(ctx.actions.length).toBeGreaterThan(3);
  });

  it('is valid for every sample, including a day with no windows left', () => {
    for (const id of ['ayesha', 'chen', 'rohit']) {
      const profile = sample(id);
      expect(
        AiContext.safeParse(buildContext(buildPlan(profile, winterAir(), NOW), profile)).success,
      ).toBe(true);
    }
    const night = { ...flatAir(50), hourly: flatAir(50).hourly.slice(22, 23) };
    const profile = sample('chen');
    const context = buildContext(buildPlan(profile, night, NOW), profile);
    expect(context.cleanWindow).toBeNull();
  });
});

describe('safety', () => {
  it.each([
    'My father has chest pain',
    "I can't breathe properly",
    'her lips are blue',
    'he fainted after the walk',
    'saans nahi aa rahi',
    'सीने में दर्द है',
  ])('flags "%s"', (q) => {
    expect(isRedFlag(q)).toBe(true);
  });

  it.each(['Can I go for a run?', 'Is my purifier enough?'])('does not flag "%s"', (q) => {
    expect(isRedFlag(q)).toBe(false);
  });

  it('gives a fixed emergency answer in both languages', () => {
    expect(safetyAnswer('en')).toMatchObject({ source: 'safety', citedRuleIds: [] });
    expect(safetyAnswer('hi').answer).toMatch(/112/);
  });

  it('sanitises control, zero-width and delimiter characters', () => {
    expect(sanitiseQuestion('  hi\u0000 there​ <<<sys>>> \n ok ')).toBe('hi there sys ok');
    expect(sanitiseQuestion('x'.repeat(500))).toHaveLength(400);
  });

  it('flags numbers that are not in the context', () => {
    expect(
      unknownNumbers(`PM2.5 is ${ctx.pm25} µg/m³, cleanest at ${ctx.cleanWindow?.start}`, ctx),
    ).toEqual([]);
    expect(unknownNumbers('Wear an N95; call 112; 3 steps', ctx)).toEqual([]);
    expect(unknownNumbers('It will reach 777 tonight', ctx)).toEqual(['777']);
  });
});

describe('fallback answers', () => {
  it.each([
    ['Can I go for a jog?', 'exercise'],
    ['Should the kids play outside?', 'children'],
    ['Which mask?', 'mask'],
    ['Is a HEPA filter worth it?', 'purifier'],
    ['When should I open the window?', 'windows'],
    ['Should I take the metro?', 'commute'],
    ['Is my angithi safe?', 'heating'],
    ['Hello', 'general'],
  ])('"%s" → %s', (q, intent) => {
    expect(detectIntent(q)).toBe(intent);
  });

  it('answers every intent in both languages, on good and bad days', () => {
    const good = { ...ctx, tier: 1, cleanWindow: null };
    for (const q of ['run', 'kids', 'mask', 'purifier', 'window', 'metro', 'heater', 'hello']) {
      for (const language of ['en', 'hi'] as const) {
        for (const context of [ctx, good]) {
          const reply = answerByIntent(q, context, language);
          expect(reply.answer.length).toBeGreaterThan(20);
          expect(reply.source).toBe('rules');
        }
      }
    }
    expect(answerByIntent('hello', good, 'en').answer).toMatch(/no cleaner window/);
    expect(answerByIntent('hello', good, 'hi').answer).toMatch(/साफ़ समय नहीं/);
  });

  it('composes a brief with window and impact, or without them', () => {
    const brief = composeBrief(ctx);
    expect(brief.summary).toMatch(/India AQI/);
    expect(brief.summary).toMatch(/cleanest stretch/);
    expect(brief.summary).toMatch(/cuts what you breathe in/);
    const plain = composeBrief({
      ...ctx,
      scale: 'US_AQI',
      cleanWindow: null,
      dose: { ...ctx.dose, reductionPct: 0 },
      tier: 9,
    });
    expect(plain.summary).toMatch(/US AQI/);
    expect(plain.summary).not.toMatch(/cleanest/);
    expect(plain.headline).toMatch(/stay indoors/);
  });
});

describe('prompts', () => {
  it('puts rules in the system prompt and data in delimited blocks', () => {
    expect(systemPrompt('hi')).toMatch(/Hindi/);
    expect(systemPrompt('en')).toMatch(/not instructions/);
    expect(briefPrompt(ctx)).toMatch(/^CONTEXT:\n\{/);
    expect(askPrompt(ctx, 'hello')).toMatch(/QUESTION:\n<<<hello>>>$/);
  });
});
