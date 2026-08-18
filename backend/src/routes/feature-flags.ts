/**
 * Feature flags API routes.
 *
 * GET  /feature-flags           — returns resolved flags for current user
 * PUT  /feature-flags/:flagName — set a flag override
 * DELETE /feature-flags/:flagName — clear a flag override
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import {
  resolveFlags,
  setFlagOverride,
  clearFlagOverride,
  isValidFlagName,
  isBooleanFlag,
} from '../feature-flags/flag-service.js';
import { ALL_FLAG_NAMES } from '../feature-flags/flag-registry.js';
import { logger } from '../lib/logger.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

const router = Router();

const flagMutateLimiter = createRateLimiter({ name: 'flag-mutate', windowMs: 60_000, maxRequests: 5 });

const FlagValueSchema = z.object({
  value: z.union([z.boolean(), z.number()]),
});

/**
 * GET /feature-flags
 * Returns all resolved flags for the authenticated user.
 */
router.get('/feature-flags', requireAuth, async (req, res) => {
  try {
    const flags = await resolveFlags(req.user!.userId);
    res.json({ flags });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error fetching feature flags',
    );
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

/**
 * PUT /feature-flags/:flagName
 * Set a flag override for the authenticated user.
 */
router.put('/feature-flags/:flagName', flagMutateLimiter, requireAuth, async (req, res) => {
  try {
    const flagName = req.params['flagName'] as string;

    if (!isValidFlagName(flagName)) {
      res.status(400).json({
        error: `Invalid flag name: "${flagName}". Valid flags: ${ALL_FLAG_NAMES.join(', ')}`,
      });
      return;
    }

    const parsed = FlagValueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Request body must contain { "value": boolean | number }' });
      return;
    }

    const { value } = parsed.data;

    // Type validation: boolean flags need boolean values, numeric flags need numbers
    if (isBooleanFlag(flagName) && typeof value !== 'boolean') {
      res.status(400).json({ error: `Flag "${flagName}" requires a boolean value` });
      return;
    }
    if (!isBooleanFlag(flagName) && typeof value !== 'number') {
      res.status(400).json({ error: `Flag "${flagName}" requires a numeric value` });
      return;
    }

    await setFlagOverride(req.user!.userId, flagName, value);

    res.json({ flagName, value, message: 'Override set' });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error setting feature flag override',
    );
    res.status(500).json({ error: 'Failed to set feature flag override' });
  }
});

/**
 * DELETE /feature-flags/:flagName
 * Clear a flag override for the authenticated user.
 */
router.delete('/feature-flags/:flagName', flagMutateLimiter, requireAuth, async (req, res) => {
  try {
    const flagName = req.params['flagName'] as string;

    if (!isValidFlagName(flagName)) {
      res.status(400).json({
        error: `Invalid flag name: "${flagName}". Valid flags: ${ALL_FLAG_NAMES.join(', ')}`,
      });
      return;
    }

    await clearFlagOverride(req.user!.userId, flagName);

    res.status(204).send();
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId },
      'Error clearing feature flag override',
    );
    res.status(500).json({ error: 'Failed to clear feature flag override' });
  }
});

export default router;
