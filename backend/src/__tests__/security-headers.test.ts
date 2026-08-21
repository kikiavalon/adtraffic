/**
 * Security headers — the API must ship a locked-down Content-Security-Policy.
 * helmet runs before routing, so even an unknown route carries the header, which
 * keeps this assertion free of any DB or per-route dependency.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('security headers', () => {
  it('sets a locked-down Content-Security-Policy on API responses', async () => {
    const res = await request(app).get('/__nonexistent_route_for_header_check__');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBe("default-src 'none'");
    // helmet still ships X-Frame-Options by default, covering anti-framing.
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
