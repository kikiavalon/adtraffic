import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('GET /health', () => {
  it('returns status and redis field', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    // Without Redis running, status is 'degraded'; with Redis it's 'ok'
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.service).toBe('adtraffic-backend');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.redis).toBeDefined();
    expect(['connected', 'disconnected']).toContain(res.body.checks.redis);
    expect(res.body.timestamp).toBeDefined();
  });
});
