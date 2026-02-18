import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'node:events';

// Mock logger before importing the middleware
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

import { requestLoggerMiddleware } from '../middleware/request-logger.js';
import { logger } from '../lib/logger.js';

function createMockReqRes(path = '/api/v1/conversations', method = 'GET'): {
  req: Partial<Request>;
  res: Partial<Response> & EventEmitter;
  next: NextFunction;
} {
  const resEmitter = new EventEmitter();
  return {
    req: {
      method,
      path,
      requestId: 'test-request-id',
    },
    res: Object.assign(resEmitter, {
      statusCode: 200,
      getHeader: vi.fn().mockReturnValue('1234'),
    }) as unknown as Partial<Response> & EventEmitter,
    next: vi.fn() as unknown as NextFunction,
  };
}

describe('requestLoggerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs request details on response close', () => {
    const { req, res, next } = createMockReqRes();
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    // Simulate response close
    res.emit('close');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-request-id',
        method: 'GET',
        path: '/api/v1/conversations',
        statusCode: 200,
      }),
      'request completed',
    );
  });

  it('includes duration_ms in log output', () => {
    const { req, res, next } = createMockReqRes();
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    res.emit('close');

    const logCall = vi.mocked(logger.info).mock.calls[0]!;
    const logData = logCall[0] as Record<string, unknown>;
    expect(logData.duration_ms).toBeTypeOf('number');
    expect(logData.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('includes content length in log output', () => {
    const { req, res, next } = createMockReqRes();
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    res.emit('close');

    const logCall = vi.mocked(logger.info).mock.calls[0]!;
    const logData = logCall[0] as Record<string, unknown>;
    expect(logData.contentLength).toBe('1234');
  });

  it('skips logging for /health path', () => {
    const { req, res, next } = createMockReqRes('/health');
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    res.emit('close');

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('skips logging for /metrics path', () => {
    const { req, res, next } = createMockReqRes('/metrics');
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    res.emit('close');

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('calls next() for all paths', () => {
    const { req, res, next } = createMockReqRes();
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();

    const { req: req2, res: res2, next: next2 } = createMockReqRes('/health');
    requestLoggerMiddleware(req2 as Request, res2 as unknown as Response, next2);
    expect(next2).toHaveBeenCalled();
  });

  it('logs POST requests with correct method', () => {
    const { req, res, next } = createMockReqRes('/api/v1/chat', 'POST');
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    res.emit('close');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/chat',
      }),
      'request completed',
    );
  });

  it('logs correct status code for error responses', () => {
    const { req, res, next } = createMockReqRes();
    (res as { statusCode: number }).statusCode = 500;
    requestLoggerMiddleware(req as Request, res as unknown as Response, next);

    res.emit('close');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
      }),
      'request completed',
    );
  });
});
