import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Global error handler — catches unhandled errors and returns a clean JSON response.
 * Prevents raw stack traces from leaking to clients.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err: { message: err.message }, requestId: _req.requestId }, 'Unhandled error');

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}
