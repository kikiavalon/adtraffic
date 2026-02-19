/**
 * Tests for the feature flags system — registry, service, middleware, routes, and tool gating.
 */

import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { db, schema } from '../db/index.js';

// Mock logger to keep test output clean
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  BOOLEAN_FLAGS,
  NUMERIC_FLAGS,
  ALL_FLAG_NAMES,
  isValidFlagName,
  isBooleanFlag,
  isNumericFlag,
  getDefaultFlags,
  type BooleanFlagName,
  type NumericFlagName,
  type ResolvedFlags,
} from '../feature-flags/flag-registry.js';

import {
  resolveFlags,
  setFlagOverride,
  clearFlagOverride,
  getUserOverrides,
} from '../feature-flags/flag-service.js';

import { featureFlagsMiddleware, requireFlag } from '../feature-flags/flag-middleware.js';

import { CM360_TOOLS, TOOL_FLAG_MAP, getEnabledTools } from '../claude/tool-definitions.js';

// Test user setup
let testUserId: string;

beforeEach(async () => {
  // Clean up in reverse dependency order
  await db.delete(schema.featureFlagOverrides);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);

  // Create a test user
  testUserId = randomUUID();
  await db.insert(schema.users).values({
    id: testUserId,
    email: `${testUserId}@test.com`,
    passwordHash: 'hashed',
    name: 'Test User',
  });

  // Clean env
  delete process.env.FEATURE_FLAGS_DEFAULTS;
});

afterEach(() => {
  delete process.env.FEATURE_FLAGS_DEFAULTS;
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// Flag Registry
// ──────────────────────────────────────────────────────────────────────────────

describe('flag-registry', () => {
  it('all boolean flags have boolean defaults', () => {
    for (const [name, def] of Object.entries(BOOLEAN_FLAGS)) {
      expect(typeof def.default).toBe('boolean');
      expect(typeof name).toBe('string');
    }
  });

  it('all numeric flags have numeric defaults', () => {
    for (const [name, def] of Object.entries(NUMERIC_FLAGS)) {
      expect(typeof def.default).toBe('number');
      expect(typeof name).toBe('string');
    }
  });

  it('flag names follow dot-notation convention', () => {
    for (const name of ALL_FLAG_NAMES) {
      expect(name).toMatch(/^[a-z0-9]+\.[a-z_]+$/);
    }
  });

  it('getDefaultFlags returns all flags with correct types', () => {
    const defaults = getDefaultFlags();
    for (const name of Object.keys(BOOLEAN_FLAGS) as BooleanFlagName[]) {
      expect(typeof defaults[name]).toBe('boolean');
    }
    for (const name of Object.keys(NUMERIC_FLAGS) as NumericFlagName[]) {
      expect(typeof defaults[name]).toBe('number');
    }
  });

  it('isValidFlagName validates correctly', () => {
    expect(isValidFlagName('cm360.write_operations')).toBe(true);
    expect(isValidFlagName('limits.daily_api_requests')).toBe(true);
    expect(isValidFlagName('invalid.flag')).toBe(false);
    expect(isValidFlagName('')).toBe(false);
  });

  it('isBooleanFlag and isNumericFlag distinguish correctly', () => {
    expect(isBooleanFlag('cm360.write_operations')).toBe(true);
    expect(isNumericFlag('cm360.write_operations' as any)).toBe(false);
    expect(isNumericFlag('limits.daily_api_requests')).toBe(true);
    expect(isBooleanFlag('limits.daily_api_requests' as any)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Flag Service
// ──────────────────────────────────────────────────────────────────────────────

describe('flag-service', () => {
  it('resolveFlags returns defaults when no overrides exist', async () => {
    const flags = await resolveFlags(testUserId);
    const defaults = getDefaultFlags();

    for (const name of ALL_FLAG_NAMES) {
      expect(flags[name as keyof ResolvedFlags]).toBe(defaults[name as keyof ResolvedFlags]);
    }
  });

  it('resolveFlags applies DB overrides correctly', async () => {
    await setFlagOverride(testUserId, 'cm360.write_operations', false);
    await setFlagOverride(testUserId, 'limits.daily_api_requests', 500);

    const flags = await resolveFlags(testUserId);
    expect(flags['cm360.write_operations']).toBe(false);
    expect(flags['limits.daily_api_requests']).toBe(500);
  });

  it('resolveFlags applies env defaults correctly', async () => {
    process.env.FEATURE_FLAGS_DEFAULTS = JSON.stringify({
      'cm360.tag_generation': false,
      'limits.max_tool_rounds': 10,
    });

    const flags = await resolveFlags(testUserId);
    expect(flags['cm360.tag_generation']).toBe(false);
    expect(flags['limits.max_tool_rounds']).toBe(10);
  });

  it('override precedence: DB > env > registry', async () => {
    // Env sets cm360.write_operations to false
    process.env.FEATURE_FLAGS_DEFAULTS = JSON.stringify({
      'cm360.write_operations': false,
    });

    // DB sets it back to true
    await setFlagOverride(testUserId, 'cm360.write_operations', true);

    const flags = await resolveFlags(testUserId);
    // DB override wins
    expect(flags['cm360.write_operations']).toBe(true);
  });

  it('setFlagOverride validates flag name', async () => {
    await expect(setFlagOverride(testUserId, 'invalid.flag', true)).rejects.toThrow(
      'Invalid flag name',
    );
  });

  it('setFlagOverride validates boolean value type', async () => {
    await expect(
      setFlagOverride(testUserId, 'cm360.write_operations', 42 as any),
    ).rejects.toThrow('requires a boolean value');
  });

  it('setFlagOverride validates numeric value type', async () => {
    await expect(
      setFlagOverride(testUserId, 'limits.daily_api_requests', true as any),
    ).rejects.toThrow('requires a numeric value');
  });

  it('setFlagOverride upserts (update on conflict)', async () => {
    await setFlagOverride(testUserId, 'cm360.write_operations', false);
    await setFlagOverride(testUserId, 'cm360.write_operations', true);

    const flags = await resolveFlags(testUserId);
    expect(flags['cm360.write_operations']).toBe(true);

    const overrides = await getUserOverrides(testUserId);
    // Should have exactly one override, not two
    const writeOpsOverrides = overrides.filter((o) => o.flagName === 'cm360.write_operations');
    expect(writeOpsOverrides).toHaveLength(1);
  });

  it('clearFlagOverride removes override', async () => {
    await setFlagOverride(testUserId, 'cm360.write_operations', false);
    expect((await resolveFlags(testUserId))['cm360.write_operations']).toBe(false);

    await clearFlagOverride(testUserId, 'cm360.write_operations');
    // Should return to default (true)
    expect((await resolveFlags(testUserId))['cm360.write_operations']).toBe(true);
  });

  it('clearFlagOverride is idempotent', async () => {
    // Clearing a non-existent override should not throw
    await expect(clearFlagOverride(testUserId, 'cm360.write_operations')).resolves.not.toThrow();
  });

  it('getUserOverrides returns only user overrides', async () => {
    const otherUserId = randomUUID();
    await db.insert(schema.users).values({
      id: otherUserId,
      email: `${otherUserId}@test.com`,
      passwordHash: 'hashed',
      name: 'Other User',
    });

    await setFlagOverride(testUserId, 'cm360.write_operations', false);
    await setFlagOverride(otherUserId, 'cm360.tag_generation', false);

    const overrides = await getUserOverrides(testUserId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]!.flagName).toBe('cm360.write_operations');
  });

  it('invalid env defaults JSON is ignored gracefully', async () => {
    process.env.FEATURE_FLAGS_DEFAULTS = 'not valid json';

    const flags = await resolveFlags(testUserId);
    // Should still return registry defaults
    expect(flags['cm360.write_operations']).toBe(true);
    expect(flags['limits.daily_api_requests']).toBe(100);
  });

  it('env defaults with invalid flag names are ignored', async () => {
    process.env.FEATURE_FLAGS_DEFAULTS = JSON.stringify({
      'invalid.flag': true,
      'cm360.write_operations': false,
    });

    const flags = await resolveFlags(testUserId);
    expect(flags['cm360.write_operations']).toBe(false);
    // No error thrown for invalid flag in env
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Flag Middleware
// ──────────────────────────────────────────────────────────────────────────────

describe('flag-middleware', () => {
  function createMockReq(user?: { userId: string; email: string }): Request {
    return { user, requestId: 'test-req-id' } as Request;
  }

  function createMockRes(): Response {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    return res;
  }

  it('attaches resolved flags to req.featureFlags', async () => {
    const req = createMockReq({ userId: testUserId, email: 'test@test.com' });
    const res = createMockRes();
    const next = vi.fn();

    await featureFlagsMiddleware(req, res, next);

    expect(req.featureFlags).toBeDefined();
    expect(typeof req.featureFlags!['cm360.write_operations']).toBe('boolean');
    expect(typeof req.featureFlags!['limits.daily_api_requests']).toBe('number');
    expect(next).toHaveBeenCalled();
  });

  it('skips flag resolution when no user (unauthenticated route)', async () => {
    const req = createMockReq(); // no user
    const res = createMockRes();
    const next = vi.fn();

    await featureFlagsMiddleware(req, res, next);

    expect(req.featureFlags).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('requireFlag returns 403 when flag is false', () => {
    const req = createMockReq({ userId: testUserId, email: 'test@test.com' });
    const defaults = getDefaultFlags();
    defaults['chat.enabled'] = false;
    req.featureFlags = defaults;
    const res = createMockRes();
    const next = vi.fn();

    requireFlag('chat.enabled')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireFlag passes when flag is true', () => {
    const req = createMockReq({ userId: testUserId, email: 'test@test.com' });
    req.featureFlags = getDefaultFlags();
    const res = createMockRes();
    const next = vi.fn();

    requireFlag('chat.enabled')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('requireFlag returns 500 if featureFlags not resolved', () => {
    const req = createMockReq({ userId: testUserId, email: 'test@test.com' });
    // No featureFlags attached
    const res = createMockRes();
    const next = vi.fn();

    requireFlag('chat.enabled')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tool Gating
// ──────────────────────────────────────────────────────────────────────────────

describe('tool gating', () => {
  it('TOOL_FLAG_MAP covers all tool names', () => {
    for (const tool of CM360_TOOLS) {
      expect(TOOL_FLAG_MAP).toHaveProperty(tool.name);
    }
    expect(Object.keys(TOOL_FLAG_MAP)).toHaveLength(CM360_TOOLS.length);
  });

  it('getEnabledTools returns all tools when all flags true', () => {
    const flags = getDefaultFlags();
    const tools = getEnabledTools(flags);
    expect(tools).toHaveLength(CM360_TOOLS.length);
  });

  it('getEnabledTools excludes write tools when cm360.write_operations is false', () => {
    const flags = getDefaultFlags();
    flags['cm360.write_operations'] = false;
    const tools = getEnabledTools(flags);

    const writeToolNames = [
      'cm360_create_campaign', 'cm360_create_placement', 'cm360_create_ad', 'cm360_create_landing_page',
      'cm360_create_creative',
      'cm360_update_campaign', 'cm360_update_placement', 'cm360_update_ad', 'cm360_update_creative', 'cm360_update_landing_page',
      'cm360_associate_creative_campaign', 'cm360_upload_creative_asset',
    ];
    for (const tool of tools) {
      expect(writeToolNames).not.toContain(tool.name);
    }
    expect(tools.length).toBe(CM360_TOOLS.length - writeToolNames.length);
  });

  it('getEnabledTools excludes tag tool when cm360.tag_generation is false', () => {
    const flags = getDefaultFlags();
    flags['cm360.tag_generation'] = false;
    const tools = getEnabledTools(flags);

    const tagTools = tools.filter((t) => t.name === 'cm360_generate_tags');
    expect(tagTools).toHaveLength(0);
    expect(tools.length).toBe(CM360_TOOLS.length - 1);
  });

  it('getEnabledTools excludes read tools when cm360.read_operations is false', () => {
    const flags = getDefaultFlags();
    flags['cm360.read_operations'] = false;
    const tools = getEnabledTools(flags);

    const readToolNames = CM360_TOOLS
      .filter((t) => TOOL_FLAG_MAP[t.name] === 'cm360.read_operations')
      .map((t) => t.name);

    for (const tool of tools) {
      expect(readToolNames).not.toContain(tool.name);
    }
  });

  it('getEnabledTools with all flags false returns empty array', () => {
    const flags = getDefaultFlags();
    flags['cm360.write_operations'] = false;
    flags['cm360.tag_generation'] = false;
    flags['cm360.read_operations'] = false;
    const tools = getEnabledTools(flags);
    expect(tools).toHaveLength(0);
  });

  it('TOOL_FLAG_MAP values are all valid boolean flag names', () => {
    for (const flagName of Object.values(TOOL_FLAG_MAP)) {
      expect(isBooleanFlag(flagName)).toBe(true);
    }
  });
});
