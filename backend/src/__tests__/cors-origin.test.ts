/**
 * CORS origin allow-list. Under the test environment (NODE_ENV=test, no
 * CHROME_EXTENSION_ID) the any-extension wildcard is OFF — it is only enabled
 * for an explicit NODE_ENV=development — so a self-hosted instance that never
 * sets NODE_ENV does not accept arbitrary chrome-extension origins.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('CORS origin allow-list', () => {
  it('reflects a localhost origin (CORS still works for the webapp dev server)', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does NOT allow an arbitrary chrome-extension origin outside development', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'chrome-extension://maliciousextensionidaaaaaaaaaaaaaa');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does NOT allow an unknown web origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
