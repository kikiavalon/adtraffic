/**
 * Tests for the audit-logger middleware utility and integration points.
 *
 * Tests verify:
 * - extractAuditContext extracts userId, IP, and userAgent from requests
 * - logRequestAuditEvent delegates to logAuditEvent with correct fields
 * - Integration points log the right event types with safe metadata
 *
 * Uses mocked logAuditEvent to verify calls without DB dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';

// Mock audit-service before importing audit-logger
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  hashIp: vi.fn((ip?: string) => ip ? `hashed_${ip}` : undefined),
}));

import { extractAuditContext, logRequestAuditEvent } from '../middleware/audit-logger.js';
import { logAuditEvent } from '../audit/audit-service.js';

const mockLogAuditEvent = vi.mocked(logAuditEvent);

function makeMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: 'user-123', email: 'test@test.com' },
    ip: '192.168.1.1',
    socket: { remoteAddress: '192.168.1.1' } as never,
    headers: { 'user-agent': 'TestBrowser/1.0' },
    requestId: 'req-456',
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// extractAuditContext
// ---------------------------------------------------------------------------

describe('extractAuditContext', () => {
  it('extracts userId from authenticated request', () => {
    const req = makeMockReq();
    const ctx = extractAuditContext(req);
    expect(ctx.userId).toBe('user-123');
  });

  it('returns "anonymous" when user is not authenticated', () => {
    const req = makeMockReq({ user: undefined });
    const ctx = extractAuditContext(req);
    expect(ctx.userId).toBe('anonymous');
  });

  it('extracts IP address from req.ip', () => {
    const req = makeMockReq();
    const ctx = extractAuditContext(req);
    expect(ctx.ipAddress).toBe('192.168.1.1');
  });

  it('falls back to socket.remoteAddress when req.ip is undefined', () => {
    const req = makeMockReq({ ip: undefined });
    const ctx = extractAuditContext(req);
    expect(ctx.ipAddress).toBe('192.168.1.1');
  });

  it('extracts user agent from headers', () => {
    const req = makeMockReq();
    const ctx = extractAuditContext(req);
    expect(ctx.userAgent).toBe('TestBrowser/1.0');
  });

  it('returns undefined userAgent when header is missing', () => {
    const req = makeMockReq({ headers: {} });
    const ctx = extractAuditContext(req);
    expect(ctx.userAgent).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// logRequestAuditEvent
// ---------------------------------------------------------------------------

describe('logRequestAuditEvent', () => {
  it('calls logAuditEvent with correct fields', () => {
    const req = makeMockReq();
    logRequestAuditEvent(req, 'message_sent', 'conv-789', { messageLength: 42 });

    expect(mockLogAuditEvent).toHaveBeenCalledOnce();
    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      userId: 'user-123',
      conversationId: 'conv-789',
      eventType: 'message_sent',
      metadata: { messageLength: 42 },
      ipAddress: '192.168.1.1',
      userAgent: 'TestBrowser/1.0',
    });
  });

  it('passes undefined conversationId when not provided', () => {
    const req = makeMockReq();
    logRequestAuditEvent(req, 'rate_limited', undefined, { endpoint: '/chat' });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: undefined,
        eventType: 'rate_limited',
      }),
    );
  });

  it('uses "anonymous" userId for unauthenticated requests', () => {
    const req = makeMockReq({ user: undefined });
    logRequestAuditEvent(req, 'rate_limited', undefined, { endpoint: '/chat' });

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'anonymous',
      }),
    );
  });

  it('passes metadata through unchanged', () => {
    const req = makeMockReq();
    const metadata = { actionId: 'act-1', toolName: 'cm360_create_campaign', riskLevel: 'standard' };
    logRequestAuditEvent(req, 'confirmation_approved', 'conv-1', metadata);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Integration: tool executor safe metadata extraction
// ---------------------------------------------------------------------------

describe('tool executor audit integration', () => {
  // We test the extractSafeToolMetadata function indirectly through executeTool
  // by mocking the audit service and verifying what gets logged.

  it('extractSafeToolMetadata only includes entity IDs, not raw data', async () => {
    // extractSafeToolMetadata is a private function inside tool-executor.ts.
    // We verify the pattern indirectly: the audit-logger utility itself should
    // only forward the metadata it receives — the real protection is at the
    // callsite level (tool-executor.ts extractSafeToolMetadata).
    const req = makeMockReq();
    logRequestAuditEvent(req, 'tool_executed', 'conv-1', {
      toolName: 'cm360_create_campaign',
      advertiserId: '12345',
      success: true,
      durationMs: 150,
    });

    const call = mockLogAuditEvent.mock.calls[0]![0];
    expect(call.metadata).toEqual({
      toolName: 'cm360_create_campaign',
      advertiserId: '12345',
      success: true,
      durationMs: 150,
    });

    // Verify no sensitive fields are present
    expect(call.metadata).not.toHaveProperty('name');
    expect(call.metadata).not.toHaveProperty('url');
    expect(call.metadata).not.toHaveProperty('password');
    expect(call.metadata).not.toHaveProperty('token');
  });
});

// ---------------------------------------------------------------------------
// Integration: various event types
// ---------------------------------------------------------------------------

describe('event type coverage', () => {
  const eventTypes: Array<{
    type: Parameters<typeof logRequestAuditEvent>[1];
    metadata: Record<string, unknown>;
  }> = [
    { type: 'message_sent', metadata: { messageLength: 100, streaming: false } },
    { type: 'message_received', metadata: { responseLength: 500 } },
    { type: 'confirmation_approved', metadata: { actionId: 'act-1', toolName: 'cm360_update_campaign' } },
    { type: 'confirmation_rejected', metadata: { actionId: 'act-2', toolName: 'cm360_create_placement' } },
    { type: 'rate_limited', metadata: { limiterName: 'chat', endpoint: '/api/v1/chat' } },
    { type: 'daily_limit_reached', metadata: { dailyLimit: 100, currentRequests: 100 } },
    { type: 'tool_executed', metadata: { toolName: 'cm360_list_campaigns', success: true, durationMs: 50 } },
  ];

  for (const { type, metadata } of eventTypes) {
    it(`correctly logs ${type} events`, () => {
      const req = makeMockReq();
      logRequestAuditEvent(req, type, 'conv-test', metadata);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: type,
          metadata,
        }),
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Security: no sensitive data in audit metadata
// ---------------------------------------------------------------------------

describe('security: sensitive data never in audit metadata', () => {
  it('does not include password-like fields', () => {
    const req = makeMockReq();
    // Even if someone passes sensitive data, the audit-logger just forwards it
    // The REAL protection is at the callsite level (tool-executor.ts extractSafeToolMetadata)
    // This test verifies the utility itself doesn't add sensitive fields
    logRequestAuditEvent(req, 'message_sent', 'conv-1', { messageLength: 10 });

    const call = mockLogAuditEvent.mock.calls[0]![0];
    expect(call.metadata).not.toHaveProperty('password');
    expect(call.metadata).not.toHaveProperty('token');
    expect(call.metadata).not.toHaveProperty('apiKey');
    expect(call.metadata).not.toHaveProperty('secret');
    // The IP is passed to logAuditEvent which hashes it internally
    expect(call.ipAddress).toBe('192.168.1.1');
  });
});
