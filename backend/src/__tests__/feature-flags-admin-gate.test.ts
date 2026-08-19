/**
 * Route-level test: mutating a feature flag is admin-only.
 * Uses the real requirePermission middleware with a mocked auth identity so the
 * admin gate itself is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

let mockRole = 'admin';
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (
    req: { user?: { userId: string; email: string; role: string } },
    _res: unknown,
    next: () => void,
  ) => {
    req.user = { userId: 'user-1', email: 'user@example.com', role: mockRole };
    next();
  },
}));

const mockSetFlagOverride = vi.fn();
const mockClearFlagOverride = vi.fn();
vi.mock('../feature-flags/flag-service.js', () => ({
  resolveFlags: vi.fn().mockResolvedValue({}),
  setFlagOverride: (...args: unknown[]) => mockSetFlagOverride(...args),
  clearFlagOverride: (...args: unknown[]) => mockClearFlagOverride(...args),
  isValidFlagName: () => true,
  isBooleanFlag: (name: string) => !name.startsWith('limits.') && name !== 'qa.retention_days',
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import featureFlagsRouter from '../routes/feature-flags.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', featureFlagsRouter);
  return app;
}

describe('feature-flag mutation is admin-only', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PUT is forbidden for non-admin roles and sets no override', async () => {
    for (const role of ['senior', 'junior']) {
      mockRole = role;
      const res = await request(makeApp())
        .put('/api/v1/feature-flags/limits.daily_api_requests')
        .send({ value: 100000 });
      expect(res.status, role).toBe(403);
    }
    expect(mockSetFlagOverride).not.toHaveBeenCalled();
  });

  it('DELETE is forbidden for non-admin roles and clears no override', async () => {
    mockRole = 'junior';
    const res = await request(makeApp()).delete('/api/v1/feature-flags/qa.click_test.enabled');
    expect(res.status).toBe(403);
    expect(mockClearFlagOverride).not.toHaveBeenCalled();
  });

  it('PUT succeeds for an admin', async () => {
    mockRole = 'admin';
    mockSetFlagOverride.mockResolvedValue(undefined);
    const res = await request(makeApp())
      .put('/api/v1/feature-flags/qa.click_test.enabled')
      .send({ value: true });
    expect(res.status).toBe(200);
    expect(mockSetFlagOverride).toHaveBeenCalledWith('user-1', 'qa.click_test.enabled', true);
  });
});
