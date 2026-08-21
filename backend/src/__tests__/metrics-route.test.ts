/**
 * /metrics endpoint authorization: open by default, but when METRICS_TOKEN is set
 * it requires a matching bearer token.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import metricsRouter from '../routes/metrics.js';

function makeApp() {
  const app = express();
  app.use(metricsRouter);
  return app;
}

const TOKEN = 'super-secret-metrics-token-value';

describe('GET /metrics authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is open when METRICS_TOKEN is unset', async () => {
    vi.stubEnv('METRICS_TOKEN', ''); // unset
    const res = await request(makeApp()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('# HELP');
  });

  it('returns 401 when METRICS_TOKEN is set and no token is provided', async () => {
    vi.stubEnv('METRICS_TOKEN', TOKEN);
    const res = await request(makeApp()).get('/metrics');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong bearer token', async () => {
    vi.stubEnv('METRICS_TOKEN', TOKEN);
    const res = await request(makeApp()).get('/metrics').set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 for the correct bearer token', async () => {
    vi.stubEnv('METRICS_TOKEN', TOKEN);
    const res = await request(makeApp()).get('/metrics').set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('# HELP');
  });
});
