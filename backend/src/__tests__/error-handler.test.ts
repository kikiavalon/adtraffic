/**
 * Tests for the global error handler middleware.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { errorHandler } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns 500 status', () => {
    const res = createMockRes();
    errorHandler(new Error('Test error'), mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns generic message in production', () => {
    process.env.NODE_ENV = 'production';
    const res = createMockRes();
    errorHandler(new Error('Sensitive internal error'), mockReq, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
  });

  it('returns error details in development', () => {
    process.env.NODE_ENV = 'development';
    const res = createMockRes();
    errorHandler(new Error('Debug info'), mockReq, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Debug info',
    });
  });

  it('never leaks stack traces in the response', () => {
    const res = createMockRes();
    const err = new Error('Oops');
    err.stack = 'Error: Oops\n    at /secret/path/file.ts:42:13';
    errorHandler(err, mockReq, res, mockNext);

    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>;
    expect(JSON.stringify(jsonArg)).not.toContain('stack');
    expect(JSON.stringify(jsonArg)).not.toContain('/secret/path');
  });

  it('logs the error message via structured logger', () => {
    vi.mocked(logger.error).mockClear();
    const res = createMockRes();
    errorHandler(new Error('Logged error'), mockReq, res, mockNext);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: { message: 'Logged error' } }),
      'Unhandled error',
    );
  });
});
