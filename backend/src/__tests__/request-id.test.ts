import { describe, it, expect } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../middleware/request-id.js';

function createMockReqRes(headers: Record<string, string> = {}): {
  req: Partial<Request>;
  res: Partial<Response>;
  next: NextFunction;
} {
  const responseHeaders: Record<string, string> = {};
  return {
    req: {
      headers: { ...headers },
    },
    res: {
      setHeader: (name: string, value: string | number | readonly string[]) => {
        responseHeaders[name as string] = String(value);
        return {} as Response;
      },
      getHeader: (name: string) => responseHeaders[name],
    },
    next: (() => {}) as NextFunction,
  };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when no X-Request-ID header is present', () => {
    const { req, res, next } = createMockReqRes();
    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('passes through existing X-Request-ID header', () => {
    const customId = 'custom-request-id-123';
    const { req, res, next } = createMockReqRes({ 'x-request-id': customId });
    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.requestId).toBe(customId);
  });

  it('sets X-Request-ID response header', () => {
    const { req, res, next } = createMockReqRes();
    requestIdMiddleware(req as Request, res as Response, next);

    const responseId = (res as { getHeader: (n: string) => string }).getHeader('X-Request-ID');
    expect(responseId).toBe(req.requestId);
  });

  it('generates unique IDs for different requests', () => {
    const { req: req1, res: res1, next: next1 } = createMockReqRes();
    const { req: req2, res: res2, next: next2 } = createMockReqRes();

    requestIdMiddleware(req1 as Request, res1 as Response, next1);
    requestIdMiddleware(req2 as Request, res2 as Response, next2);

    expect(req1.requestId).not.toBe(req2.requestId);
  });

  it('ignores empty X-Request-ID header', () => {
    const { req, res, next } = createMockReqRes({ 'x-request-id': '' });
    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).not.toBe('');
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('calls next()', () => {
    const { req, res } = createMockReqRes();
    let called = false;
    const next = (() => { called = true; }) as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);
    expect(called).toBe(true);
  });
});
