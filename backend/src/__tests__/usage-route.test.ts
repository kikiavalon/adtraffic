/**
 * /api/v1/usage route tests.
 *
 * Regression: the handler previously passed the getUsageSummary() promise
 * straight to res.json(), serializing an empty object. These tests assert the
 * response contains the awaited Claude usage fields plus the `google` section.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';
import { resetGoogleUsageTracker, recordGoogleApiRequest } from '../cm360/google-usage-tracker.js';

let token: string;

beforeEach(async () => {
  resetGoogleUsageTracker();
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.oauthTokens);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);

  const ts = Date.now();
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: `usage-test-${ts}@agency.com`, password: 'SecurePass123', name: 'Usage Tester' });
  token = res.body.token;
});

describe('GET /api/v1/usage', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/usage');
    expect(res.status).toBe(401);
  });

  it('returns awaited Claude usage fields (not an empty object)', async () => {
    const res = await request(app)
      .get('/api/v1/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(new Date().toISOString().slice(0, 10));
    expect(typeof res.body.requests).toBe('number');
    expect(typeof res.body.limit).toBe('number');
    expect(typeof res.body.totalTokens).toBe('number');
    expect(typeof res.body.estimatedCost).toBe('string');
  });

  it('includes Google CM360 usage under the google key', async () => {
    await recordGoogleApiRequest();
    await recordGoogleApiRequest();

    const res = await request(app)
      .get('/api/v1/usage')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.google).toEqual({
      date: new Date().toISOString().slice(0, 10),
      requests: 2,
    });
  });
});
