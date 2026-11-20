import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AiDisabledError, DisabledAiClient } from '../../../src/server/ai/client.js';
import { TtlCache } from '../../../src/server/cache.js';
import { systemClock } from '../../../src/server/clock.js';
import { silentLogger } from '../../../src/server/logger.js';
import { makeApp, sharmaContext } from '../../helpers/fakes.js';

describe('TtlCache', () => {
  it('expires entries after the TTL', () => {
    let now = 0;
    const cache = new TtlCache<string>(10, 100, () => now);
    cache.set('a', 'x');
    expect(cache.get('a')).toBe('x');
    now = 100;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry beyond the limit', () => {
    const cache = new TtlCache<number>(2, 1000, () => 0);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(2);
  });

  it('de-duplicates concurrent loads and skips caching rejected values', async () => {
    const cache = new TtlCache<string>(10, 1000, () => 0);
    let calls = 0;
    const loader = (): Promise<string> => {
      calls += 1;
      return Promise.resolve(`v${calls}`);
    };
    const [a, b] = await Promise.all([cache.load('k', loader), cache.load('k', loader)]);
    expect([a, b, calls]).toEqual(['v1', 'v1', 1]);
    expect(await cache.load('k', loader)).toBe('v1');
    expect(await cache.load('skip', loader, () => false)).toBe('v2');
    expect(await cache.load('skip', loader, () => false)).toBe('v3');
  });

  it('clears the in-flight entry after a failure so the next call retries', async () => {
    const cache = new TtlCache<string>(10, 1000, () => 0);
    await expect(cache.load('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.load('k', () => Promise.resolve('up'))).toBe('up');
  });
});

describe('same-origin guard', () => {
  const context = sharmaContext();

  it('refuses a malformed or null Origin', async () => {
    const app = makeApp();
    const nullOrigin = await request(app)
      .post('/api/brief')
      .set('Origin', 'null')
      .send({ context });
    expect(nullOrigin.status).toBe(403);
  });

  it('honours the forwarded host from the trusted proxy', async () => {
    const res = await request(makeApp())
      .post('/api/brief')
      .set('X-Forwarded-Host', 'smogwise.example, internal')
      .set('Origin', 'https://smogwise.example')
      .send({ context });
    expect(res.status).toBe(200);
  });

  it('allows GET from anywhere (read-only, rate-limited)', async () => {
    const res = await request(makeApp()).get('/api/health').set('Sec-Fetch-Site', 'cross-site');
    expect(res.status).toBe(200);
  });
});

describe('small defaults', () => {
  it('the disabled AI client always rejects with a named error', async () => {
    const client = new DisabledAiClient();
    expect(client.enabled).toBe(false);
    await expect(client.generateJson()).rejects.toBeInstanceOf(AiDisabledError);
  });

  it('the system clock and silent logger work', () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
    expect(() => {
      silentLogger.log('info', 'quiet');
    }).not.toThrow();
  });
});
