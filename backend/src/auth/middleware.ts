import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './auth-service.js';
import { readAuthCookie } from './cookies.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Prefer the httpOnly session cookie (used by the webapp); fall back to a
  // Bearer token for API clients, the extension, and tests.
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = readAuthCookie(req) ?? bearer;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
