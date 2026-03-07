import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** Only accept alphanumeric + hyphens, max 36 chars (UUID length) */
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-]{1,36}$/;

/**
 * Middleware that assigns a unique correlation ID to each request.
 *
 * - Reads `X-Request-ID` header if provided by the client/load balancer.
 * - Validates format (alphanumeric + hyphens, max 36 chars) to prevent injection.
 * - Otherwise generates a new UUID via `crypto.randomUUID()`.
 * - Sets `req.requestId` for downstream middleware and route handlers.
 * - Echoes the ID back in the `X-Request-ID` response header.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' && REQUEST_ID_PATTERN.test(existingId)
    ? existingId
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
