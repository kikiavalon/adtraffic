import { Router } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { ChatRequestSchema } from '@adtraffic/shared';
import type { ChatResponse } from '@adtraffic/shared';
import { chat } from '../claude/kiki-service.js';
import { requireAuth } from '../auth/middleware.js';
import { saveMessage, getConversation } from '../db/conversation-store.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../lib/logger.js';
import { featureFlagsMiddleware } from '../feature-flags/flag-middleware.js';

const router = Router();

// Rate limit chat: 20 requests per minute per IP
const chatLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

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

  const { conversationId, message } = parsed.data;

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

    const assistantMessage = await chat(conversationId, message, req.featureFlags);

    // Save assistant message to DB
    await saveMessage(conversationId, assistantMessage);

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

export default router;
