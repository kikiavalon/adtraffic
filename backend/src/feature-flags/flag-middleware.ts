/**
 * Feature flag middleware — resolves flags for the authenticated user
 * and attaches them to req.featureFlags.
 *
 * Must run after requireAuth (needs req.user.userId).
 */

import type { Request, Response, NextFunction } from 'express';
import { resolveFlags } from './flag-service.js';
import { logger } from '../lib/logger.js';
import type { BooleanFlagName } from './flag-registry.js';

/**
 * Middleware that resolves feature flags for the current user.
 * Attaches resolved flags to req.featureFlags.
 */
export async function featureFlagsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    // No user — skip flag resolution (unauthenticated routes)
    next();
    return;
  }

  try {
    const flags = await resolveFlags(req.user.userId);
    req.featureFlags = flags;

    logger.debug(
      { requestId: req.requestId, userId: req.user.userId, flags },
      'Feature flags resolved',
    );

    next();
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Failed to resolve feature flags',
    );
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Higher-order middleware: returns 403 if the specified boolean flag is false.
 *
 * Usage:
 *   router.post('/chat', requireAuth, requireFlag('chat.enabled'), handler);
 */
export function requireFlag(flagName: BooleanFlagName) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.featureFlags) {
      res.status(500).json({ error: 'Feature flags not resolved' });
      return;
    }

    if (!req.featureFlags[flagName]) {
      res.status(403).json({ error: `Feature "${flagName}" is not enabled for your account` });
      return;
    }

    next();
  };
}
