import request from 'supertest';
import { describe, expect, it } from 'vitest';

describe('Vercel entry (api/index.ts)', () => {
  it('exports the same Express app, with the security headers', async () => {
    const { default: app } = await import('../../api/index.js');
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, version: '1.0.0' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});
