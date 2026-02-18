/**
 * Feature flag service — resolves flags for a user by merging:
 *   registry defaults → env defaults → user DB overrides
 *
 * The env layer uses FEATURE_FLAGS_DEFAULTS (JSON string) for deployment-wide
 * overrides without code changes. The DB layer stores per-user overrides.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { featureFlagOverrides } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import {
  BOOLEAN_FLAGS,
  NUMERIC_FLAGS,
  getDefaultFlags,
  isValidFlagName,
  isBooleanFlag,
  isNumericFlag,
  type ResolvedFlags,
} from './flag-registry.js';

/** A single flag override row from the database */
export interface FlagOverride {
  flagName: string;
  value: boolean | number;
  updatedAt: Date;
}

/**
 * Parse env-level flag defaults from FEATURE_FLAGS_DEFAULTS.
 * Expected format: JSON object, e.g. {"cm360.write_operations": false, "limits.daily_api_requests": 200}
 */
function parseEnvDefaults(): Record<string, boolean | number> {
  const raw = process.env.FEATURE_FLAGS_DEFAULTS;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, boolean | number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidFlagName(key) && (typeof value === 'boolean' || typeof value === 'number')) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    logger.warn({ raw }, 'Invalid FEATURE_FLAGS_DEFAULTS JSON — ignoring');
    return {};
  }
}

/**
 * Resolve all flags for a user.
 * Precedence: user DB override > env defaults > registry defaults.
 */
export async function resolveFlags(userId: string): Promise<ResolvedFlags> {
  const flags = getDefaultFlags();

  // Layer 2: env defaults
  const envDefaults = parseEnvDefaults();
  for (const [key, value] of Object.entries(envDefaults)) {
    if (key in flags) {
      (flags as Record<string, boolean | number>)[key] = value;
    }
  }

  // Layer 3: user DB overrides
  try {
    const overrides = await db
      .select()
      .from(featureFlagOverrides)
      .where(eq(featureFlagOverrides.userId, userId));

    for (const override of overrides) {
      if (isValidFlagName(override.flagName)) {
        const parsed = JSON.parse(override.value) as unknown;
        if (isBooleanFlag(override.flagName) && typeof parsed === 'boolean') {
          (flags as Record<string, boolean | number>)[override.flagName] = parsed;
        } else if (isNumericFlag(override.flagName) && typeof parsed === 'number') {
          (flags as Record<string, boolean | number>)[override.flagName] = parsed;
        }
      }
    }
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' }, userId },
      'Failed to load feature flag overrides — using defaults',
    );
  }

  return flags;
}

/**
 * Set a flag override for a user. Validates flag name and value type.
 * Upserts — creates if not exists, updates if exists.
 */
export async function setFlagOverride(
  userId: string,
  flagName: string,
  value: boolean | number,
): Promise<void> {
  if (!isValidFlagName(flagName)) {
    throw new Error(`Invalid flag name: ${flagName}`);
  }

  if (isBooleanFlag(flagName) && typeof value !== 'boolean') {
    throw new Error(`Flag "${flagName}" requires a boolean value, got ${typeof value}`);
  }

  if (isNumericFlag(flagName) && typeof value !== 'number') {
    throw new Error(`Flag "${flagName}" requires a numeric value, got ${typeof value}`);
  }

  // Upsert: insert or update on conflict
  await db
    .insert(featureFlagOverrides)
    .values({
      userId,
      flagName,
      value: JSON.stringify(value),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [featureFlagOverrides.userId, featureFlagOverrides.flagName],
      set: {
        value: JSON.stringify(value),
        updatedAt: new Date(),
      },
    });

  logger.info({ userId, flagName, value }, 'Feature flag override set');
}

/**
 * Clear a flag override for a user. Idempotent — no error if not exists.
 */
export async function clearFlagOverride(
  userId: string,
  flagName: string,
): Promise<void> {
  if (!isValidFlagName(flagName)) {
    throw new Error(`Invalid flag name: ${flagName}`);
  }

  await db
    .delete(featureFlagOverrides)
    .where(
      and(
        eq(featureFlagOverrides.userId, userId),
        eq(featureFlagOverrides.flagName, flagName),
      ),
    );

  logger.info({ userId, flagName }, 'Feature flag override cleared');
}

/**
 * Get all flag overrides for a user.
 */
export async function getUserOverrides(userId: string): Promise<FlagOverride[]> {
  const rows = await db
    .select()
    .from(featureFlagOverrides)
    .where(eq(featureFlagOverrides.userId, userId));

  return rows.map((row) => ({
    flagName: row.flagName,
    value: JSON.parse(row.value) as boolean | number,
    updatedAt: row.updatedAt,
  }));
}

// Re-export types and utilities for convenience
export { BOOLEAN_FLAGS, NUMERIC_FLAGS, isValidFlagName, isBooleanFlag, isNumericFlag };
export type { FlagName, ResolvedFlags, BooleanFlagName, NumericFlagName } from './flag-registry.js';
