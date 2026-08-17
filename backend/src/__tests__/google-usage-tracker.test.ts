/**
 * Google CM360 API usage tracker tests.
 *
 * Redis is unavailable in unit tests, so these exercise the in-memory fallback:
 * recording requests, summarizing, and per-test reset.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordGoogleApiRequest,
  getGoogleUsageSummary,
  resetGoogleUsageTracker,
} from '../cm360/google-usage-tracker.js';

describe('google-usage-tracker', () => {
  beforeEach(() => {
    resetGoogleUsageTracker();
  });

  it('starts at zero requests for today', async () => {
    const summary = await getGoogleUsageSummary();
    expect(summary.requests).toBe(0);
    expect(summary.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('increments the request count on each recorded call', async () => {
    await recordGoogleApiRequest();
    await recordGoogleApiRequest();
    await recordGoogleApiRequest();

    const summary = await getGoogleUsageSummary();
    expect(summary.requests).toBe(3);
  });

  it('resets to zero via resetGoogleUsageTracker', async () => {
    await recordGoogleApiRequest();
    resetGoogleUsageTracker();

    const summary = await getGoogleUsageSummary();
    expect(summary.requests).toBe(0);
  });
});
