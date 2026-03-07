import { Router } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { ChatRequestSchema } from '@adtraffic/shared';
import type { ChatResponse, StreamEvent } from '@adtraffic/shared';
import { chat, chatStream } from '../claude/kiki-service.js';
import { requireAuth } from '../auth/middleware.js';
import { saveMessage, getConversation } from '../db/conversation-store.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../lib/logger.js';
import { featureFlagsMiddleware } from '../feature-flags/flag-middleware.js';
import { logRequestAuditEvent } from '../middleware/audit-logger.js';

const router = Router();

// Rate limit chat: 20 requests per minute per IP
const chatLimiter = createRateLimiter({ name: 'chat', windowMs: 60_000, maxRequests: 20 });

/** Allowed MIME types for file upload attachments */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
]);

/**
 * POST /api/chat
 *
 * Receives a user message, forwards to Claude API via Kiki service,
 * returns Kiki's AI-generated response.
 * Uses a larger body limit (10mb) for messages that may include file uploads.
 *
 * Middleware order: rate limit → auth check → body parse.
 * Auth runs before the body parser so unauthenticated requests
 * cannot force the server to buffer large payloads (DoS prevention).
 */
router.post('/chat', chatLimiter, requireAuth, featureFlagsMiddleware, express.json({ limit: '10mb' }), async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
    });
    return;
  }

  const { conversationId, message, attachment } = parsed.data;

  // Check file_upload feature flag if attachment present
  if (attachment && req.featureFlags && !req.featureFlags['chat.file_upload']) {
    res.status(403).json({ error: 'File upload is not enabled for your account' });
    return;
  }

  // Validate MIME type if attachment present
  if (attachment && !ALLOWED_MIME_TYPES.has(attachment.type)) {
    res.status(400).json({ error: `Unsupported file type: ${attachment.type}. Allowed: PDF, Excel, CSV` });
    return;
  }

  try {
    const userId = req.user!.userId;

    // Verify conversation ownership — prevent cross-user access (IDOR)
    const existing = await getConversation(conversationId);
    if (existing && existing.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Save user message to DB
    await saveMessage(conversationId, {
      id: randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }, userId);

    // Audit: user sent a message
    logRequestAuditEvent(req, 'message_sent', conversationId, {
      messageLength: message.length,
    });

    const assistantMessage = await chat(conversationId, message, userId, req.featureFlags, attachment, req.user!.role);

    // Save assistant message to DB
    await saveMessage(conversationId, assistantMessage);

    // Audit: Kiki responded
    logRequestAuditEvent(req, 'message_received', conversationId, {
      responseLength: typeof assistantMessage.content === 'string' ? assistantMessage.content.length : 0,
    });

    const response: ChatResponse = {
      conversationId,
      message: assistantMessage,
    };

    res.json(response);
  } catch (error) {
    logger.error({ err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId }, 'Claude API error');
    res.status(500).json({
      error: 'Failed to get response from Kiki',
    });
  }
});

/**
 * POST /api/chat/stream
 *
 * SSE streaming variant of /api/chat. Returns Server-Sent Events
 * with real-time text deltas and tool execution status.
 *
 * Same middleware chain and validation as /api/chat.
 * The non-streaming /api/chat endpoint is preserved as a fallback.
 */
router.post('/chat/stream', chatLimiter, requireAuth, featureFlagsMiddleware, express.json({ limit: '10mb' }), async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
    });
    return;
  }

  const { conversationId, message, attachment } = parsed.data;

  // Check file_upload feature flag if attachment present
  if (attachment && req.featureFlags && !req.featureFlags['chat.file_upload']) {
    res.status(403).json({ error: 'File upload is not enabled for your account' });
    return;
  }

  // Validate MIME type if attachment present
  if (attachment && !ALLOWED_MIME_TYPES.has(attachment.type)) {
    res.status(400).json({ error: `Unsupported file type: ${attachment.type}. Allowed: PDF, Excel, CSV` });
    return;
  }

  try {
    const userId = req.user!.userId;

    // Verify conversation ownership — prevent cross-user access (IDOR)
    const existing = await getConversation(conversationId);
    if (existing && existing.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Save user message to DB
    await saveMessage(conversationId, {
      id: randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }, userId);

    // Audit: user sent a message (streaming)
    logRequestAuditEvent(req, 'message_sent', conversationId, {
      messageLength: message.length,
      streaming: true,
    });

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Helper to send typed SSE events
    const sendEvent = (event: StreamEvent) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    // Handle client disconnect — abort the Claude API call
    const controller = new AbortController();
    req.on('close', () => {
      clearTimeout(sseTimeout);
      controller.abort();
    });

    // Server-side timeout: close connection after 5 minutes to prevent resource leaks
    const sseTimeout = setTimeout(() => {
      try {
        sendEvent({ type: 'error', error: 'Connection timed out' });
        sendEvent({ type: 'done' });
      } catch { /* client may have disconnected */ }
      res.end();
      controller.abort();
    }, 300_000); // 5 minutes

    try {
      await chatStream(conversationId, message, sendEvent, controller.signal, userId, req.featureFlags, attachment, req.user!.role);

      // Audit: Kiki responded (streaming complete)
      logRequestAuditEvent(req, 'message_received', conversationId, {
        streaming: true,
      });
    } catch (error) {
      // Don't send error events for intentional client disconnects
      if (!(error instanceof Error && error.name === 'AbortError')) {
        sendEvent({ type: 'error', error: 'Failed to get response from Kiki' });
      }
    }

    clearTimeout(sseTimeout);

    // Save assistant message — chatStream() handles this internally via message_end
    // The final message is saved inside chatStream() when it emits message_end

    sendEvent({ type: 'done' });
    res.end();
  } catch (error) {
    // If headers haven't been sent yet, return a JSON error
    if (!res.headersSent) {
      logger.error({ err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId }, 'Stream setup error');
      res.status(500).json({
        error: 'Failed to start streaming response',
      });
    } else {
      // Headers already sent — try to send an SSE error event
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`);
        res.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
      } catch { /* client may have disconnected */ }
      res.end();
    }
  }
});

export default router;
