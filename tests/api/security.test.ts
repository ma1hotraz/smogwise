import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/server/config.js';
import { createLogger, redact } from '../../src/server/logger.js';
import { errorHandler } from '../../src/server/middleware/errors.js';
import { captureLogger, makeApp, sharmaContext } from '../helpers/fakes.js';

const context = sharmaContext();

describe('security headers', () => {
  it('sets a strict CSP and hardening headers on API responses', async () => {
    const res = await request(makeApp()).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toContain('geolocation=(self)');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request hardening', () => {
  it('415 for non-JSON bodies', async () => {
    const res = await request(makeApp())
      .post('/api/brief')
      .set('content-type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(415);
  });

  it('413 for bodies over 16 kB and 400 for malformed JSON', async () => {
    const big = await request(makeApp())
      .post('/api/ask')
      .send({ question: 'x'.repeat(20_000), context, language: 'en' });
    expect(big.status).toBe(413);
    const broken = await request(makeApp())
      .post('/api/ask')
      .set('content-type', 'application/json')
      .send('{"question":');
    expect(broken.status).toBe(400);
  });

  it('403 for cross-site POSTs, allowed for same-origin', async () => {
    const app = makeApp();
    const cross = await request(app)
      .post('/api/brief')
      .set('Origin', 'https://evil.example')
      .send({ context });
    expect(cross.status).toBe(403);
    const site = await request(app)
      .post('/api/brief')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ context });
    expect(site.status).toBe(403);
    const same = await request(app)
      .post('/api/brief')
      .set('Host', 'smogwise.test')
      .set('Origin', 'https://smogwise.test')
      .send({ context });
    expect(same.status).toBe(200);
  });

  it('429 after the per-minute AI limit', async () => {
    const app = makeApp({ config: { rateLimitPerMin: 2 } });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await request(app).post('/api/brief').send({ context })).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('404 JSON for unknown routes', async () => {
    const res = await request(makeApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});

describe('errors never leak details', () => {
  it('returns a generic 500 with a request id and logs the error name only', () => {
    const logger = captureLogger();
    const sent: { status?: number; body?: unknown } = {};
    const res = {
      locals: { requestId: 'req-1' },
      status(code: number) {
        sent.status = code;
        return this;
      },
      json(body: unknown) {
        sent.body = body;
        return this;
      },
    };
    const secret = new TypeError('database password is hunter2');
    errorHandler(logger)(secret, {} as never, res as never, () => undefined);
    expect(sent).toEqual({ status: 500, body: { error: 'internal_error', requestId: 'req-1' } });
    expect(JSON.stringify(logger.lines)).not.toContain('hunter2');
    errorHandler(logger)('weird', {} as never, { ...res, locals: {} } as never, () => undefined);
    expect(logger.lines[1]?.fields).toEqual({ requestId: '', reason: 'unknown' });
  });
});

describe('config and logging', () => {
  it('parses defaults and treats an empty key as disabled', () => {
    const config = loadConfig({ GEMINI_API_KEY: '' });
    expect(config).toMatchObject({
      port: 8080,
      geminiApiKey: undefined,
      geminiModel: 'gemini-3.5-flash-lite',
      rateLimitPerMin: 10,
    });
    expect(loadConfig({ GEMINI_API_KEY: ' abc ', PORT: '9000' })).toMatchObject({
      geminiApiKey: 'abc',
      port: 9000,
    });
  });

  it('fails fast naming the variable, never its value', () => {
    expect(() => loadConfig({ PORT: '-1', GEMINI_API_KEY: 'AIzaSECRET' })).toThrow(
      'Invalid configuration: PORT',
    );
  });

  it('redacts credential-like fields and writes JSON lines', () => {
    expect(redact({ apiKey: 'x', promptTokens: 5, authorization: 'y' })).toEqual({
      apiKey: '[redacted]',
      promptTokens: 5,
      authorization: '[redacted]',
    });
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).log('info', 'hello', { route: '/api' });
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: 'info', msg: 'hello', route: '/api' });
  });
});
