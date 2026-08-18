import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/** Paths to skip logging (high-frequency health/metrics noise). */
const SKIP_PATHS = new Set(['/health', '/metrics']);

/**
 * Middleware that logs structured request/response information.
 *
 * Logs method, path, status code, duration, and content length on response close.
 * Skips /health and /metrics to reduce noise.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();

  res.on('close', () => {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;

    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
        contentLength: res.getHeader('content-length'),
      },
      'request completed',
    );
  });

  next();
}
