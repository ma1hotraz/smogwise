import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AirData } from '../../src/shared/schema/air.js';
import { airBody, captureLogger, FakeAi, fakeFetch, makeApp } from '../helpers/fakes.js';

describe('GET /api/health', () => {
  it('reports AI status and version without secrets', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, ai: 'disabled', version: '1.0.0' });
    const enabled = await request(makeApp({ ai: new FakeAi() })).get('/api/health');
    expect(enabled.body.ai).toBe('enabled');
  });
});

describe('GET /api/geocode', () => {
  it('returns validated places and drops malformed ones', async () => {
    const res = await request(makeApp()).get('/api/geocode').query({ q: 'Delhi' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toEqual({
      name: 'Delhi',
      admin1: 'National Capital Territory of Delhi',
      countryCode: 'IN',
      lat: 28.65,
      lon: 77.23,
      timezone: 'Asia/Kolkata',
    });
  });

  it('accepts names in other scripts', async () => {
    const res = await request(makeApp()).get('/api/geocode').query({ q: 'दिल्ली' });
    expect(res.status).toBe(200);
  });

  it.each([['a'], ['<script>'], ['Delhi; DROP'], ['x'.repeat(61)]])(
    'rejects q=%s with 400',
    async (q) => {
      const res = await request(makeApp()).get('/api/geocode').query({ q });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'invalid_request' });
    },
  );

  it('rejects unknown and repeated parameters', async () => {
    expect((await request(makeApp()).get('/api/geocode?q=Delhi&x=1')).status).toBe(400);
    expect((await request(makeApp()).get('/api/geocode?q=Delhi&q=Pune')).status).toBe(400);
  });

  it('caches by query and handles empty results', async () => {
    const fetch = fakeFetch({ geocode: () => Response.json({}) });
    const app = makeApp({ fetch });
    const first = await request(app).get('/api/geocode').query({ q: 'Nowhere' });
    expect(first.body).toEqual({ results: [] });
    await request(app).get('/api/geocode').query({ q: 'nowhere' });
    expect(fetch.urls).toHaveLength(1);
    expect(fetch.urls[0]?.host).toBe('geocoding-api.open-meteo.com');
  });

  it('maps a geocoding failure to 502', async () => {
    const fetch = fakeFetch({ geocode: () => Response.json({ results: 'bad' }) });
    const res = await request(makeApp({ fetch })).get('/api/geocode').query({ q: 'Pune' });
    expect(res.status).toBe(502);
  });
});

describe('GET /api/air', () => {
  it('rounds coordinates to 0.1° before calling upstream and returns valid AirData', async () => {
    const fetch = fakeFetch();
    const res = await request(makeApp({ fetch }))
      .get('/api/air')
      .query({ lat: '28.6519', lon: '77.2315' });
    expect(res.status).toBe(200);
    expect(AirData.safeParse(res.body).success).toBe(true);
    expect(res.body.hourly).toHaveLength(48);
    expect(res.body.source).toBe('open-meteo');
    expect(res.headers['cache-control']).toBe('no-store');
    const url = fetch.urls[0]!;
    expect(url.host).toBe('air-quality-api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('28.7');
    expect(url.searchParams.get('longitude')).toBe('77.2');
  });

  it('shares one upstream call across the same cell (cache + in-flight de-dup)', async () => {
    const fetch = fakeFetch();
    const app = makeApp({ fetch });
    await Promise.all([
      request(app).get('/api/air').query({ lat: 28.61, lon: 77.21 }),
      request(app).get('/api/air').query({ lat: 28.64, lon: 77.19 }),
    ]);
    await request(app).get('/api/air').query({ lat: 28.62, lon: 77.18 });
    expect(fetch.urls).toHaveLength(1);
  });

  it('drops null hours, clamps values and trims to 48 hours', async () => {
    const values = Array.from({ length: 60 }, (_, i) => (i === 0 ? null : i === 1 ? 5000 : 80));
    const fetch = fakeFetch({ air: () => Response.json(airBody(values)) });
    const res = await request(makeApp({ fetch })).get('/api/air').query({ lat: 10, lon: 10 });
    expect(res.body.hourly).toHaveLength(48);
    expect(res.body.hourly[0].pm25).toBe(2000);
    expect(res.body.hourly[0].pm10).toBe(2000);
  });

  it('keeps hours with a missing PM10 reading', async () => {
    const body = airBody([50, 60]);
    body.hourly.pm10 = [null, 70];
    const fetch = fakeFetch({ air: () => Response.json(body) });
    const res = await request(makeApp({ fetch })).get('/api/air').query({ lat: 1, lon: 2 });
    expect(res.body.hourly[0].pm10).toBeNull();
  });

  it.each([
    [{ lat: '91', lon: '0' }],
    [{ lat: 'abc', lon: '0' }],
    [{ lat: '0' }],
    [{ lat: '0', lon: '181' }],
    [{ lat: '0', lon: '0', extra: '1' }],
  ])('rejects %o with 400', async (query) => {
    expect((await request(makeApp()).get('/api/air').query(query)).status).toBe(400);
  });

  it.each([
    ['non-200', () => new Response('nope', { status: 500 })],
    ['invalid JSON', () => new Response('{oops', { status: 200 })],
    ['schema mismatch', () => Response.json({ hourly: 'x' })],
    ['empty series', () => Response.json(airBody([]))],
    [
      'oversized by header',
      () => new Response('{}', { headers: { 'content-length': String(10_000_000) } }),
    ],
    ['oversized body', () => new Response(JSON.stringify({ pad: 'x'.repeat(600_000) }))],
    ['network error', () => Promise.reject(new TypeError('fetch failed'))],
  ])('maps %s to a generic 502 and logs the reason only', async (_name, handler) => {
    const logger = captureLogger();
    const res = await request(makeApp({ fetch: fakeFetch({ air: handler }), logger }))
      .get('/api/air')
      .query({ lat: 1, lon: 1 });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'upstream_unavailable' });
    expect(logger.lines.some((l) => l.msg === 'upstream_failed')).toBe(true);
  });
});

describe('static client', () => {
  it('serves the SPA with no-cache, immutable assets and the CSP', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'smogwise-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Smogwise</title>');
    writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    const app = makeApp({ staticDir: dir });
    const page = await request(app).get('/today');
    expect(page.status).toBe(200);
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.headers['content-security-policy']).toContain("script-src 'self'");
    const asset = await request(app).get('/assets/app.js');
    expect(asset.headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/api/nothing')).status).toBe(404);
  });
});
