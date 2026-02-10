import type { Request, Response, NextFunction } from 'express';

/**
 * Global error handler — catches unhandled errors and returns a clean JSON response.
 * Prevents raw stack traces from leaking to clients.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err.message);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
}
