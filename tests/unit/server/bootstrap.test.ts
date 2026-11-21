import fs from 'node:fs';
import path from 'node:path';

import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { bootstrap } from '../../../src/server/bootstrap.js';
import { CSP_DIRECTIVES, PERMISSIONS_POLICY } from '../../../src/server/middleware/security.js';
import { sharmaContext } from '../../helpers/fakes.js';
import { generateContent } from '../../helpers/genai.js';

vi.mock('@google/genai', async (importActual) =>
  (await import('../../helpers/genai.js')).fakeGenAiModule(importActual),
);

describe('bootstrap', () => {
  it('logs token usage (counts only, never content) after a model call', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ answer: 'Walk indoors today.', citedRuleIds: [], followUps: [] }),
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 },
    });
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const { app } = bootstrap({ NODE_ENV: 'test', GEMINI_API_KEY: 'k' });
    const question = 'secret question text about my mother';
    await request(app)
      .post('/api/ask')
      .send({ question, context: sharmaContext(), language: 'en' });
    const lines = write.mock.calls.map((call) => String(call[0]));
    write.mockRestore();
    const usage = lines.find((line) => line.includes('ai_usage')) ?? '';
    expect(JSON.parse(usage)).toMatchObject({ promptTokens: 12, outputTokens: 5 });
    expect(lines.join('')).not.toContain(question);
  });

  it('wires the real fetch into the upstream client (network is disabled in tests, so 502)', async () => {
    const { app } = bootstrap({ NODE_ENV: 'test' });
    const res = await request(app).get('/api/air').query({ lat: 1, lon: 1 });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'upstream_unavailable' });
  });

  it('uses the disabled client without a key', async () => {
    const { app, aiEnabled } = bootstrap({ NODE_ENV: 'test' });
    expect(aiEnabled).toBe(false);
    expect((await request(app).get('/api/health')).body.ai).toBe('disabled');
  });

  it('enables Gemini when a key is present, without exposing it', async () => {
    const { app, aiEnabled } = bootstrap({ NODE_ENV: 'test', GEMINI_API_KEY: 'test-key-value' });
    expect(aiEnabled).toBe(true);
    const res = await request(app).get('/api/health');
    expect(res.body.ai).toBe('enabled');
    expect(JSON.stringify(res.body) + JSON.stringify(res.headers)).not.toContain('test-key-value');
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
    rewrites: { source: string; destination: string }[];
  };
  const allHeaders = config.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
  const header = (key: string) => allHeaders.find((h) => h.key === key)?.value ?? '';

  it('sends the same CSP as the Express app, with no unsafe directives', async () => {
    const { app } = bootstrap({ NODE_ENV: 'test' });
    const served = String(
      (await request(app).get('/api/health')).headers['content-security-policy'],
    );
    const normalise = (csp: string) =>
      csp
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .sort();
    expect(normalise(header('Content-Security-Policy'))).toEqual(normalise(served));
    expect(header('Content-Security-Policy')).not.toMatch(/unsafe-/);
    expect(Object.keys(CSP_DIRECTIVES).length).toBeGreaterThan(5);
  });

  it('carries the companion security headers and routes /api to the function', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(header('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(header('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(config.rewrites[0]).toEqual({ source: '/api/(.*)', destination: '/api' });
  });
});
