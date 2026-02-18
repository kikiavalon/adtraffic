import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that assigns a unique correlation ID to each request.
 *
 * - Reads `X-Request-ID` header if provided by the client/load balancer.
 * - Otherwise generates a new UUID via `crypto.randomUUID()`.
 * - Sets `req.requestId` for downstream middleware and route handlers.
 * - Echoes the ID back in the `X-Request-ID` response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' && existingId.length > 0
    ? existingId
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
