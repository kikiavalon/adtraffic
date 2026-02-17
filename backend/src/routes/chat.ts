import { Router } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { ChatRequestSchema } from '@adtraffic/shared';
import type { ChatResponse } from '@adtraffic/shared';
import { chat } from '../claude/kiki-service.js';
import { requireAuth } from '../auth/middleware.js';
import { saveMessage } from '../db/conversation-store.js';

const router = Router();

/**
 * POST /api/chat
 *
 * Receives a user message, forwards to Claude API via Kiki service,
 * returns Kiki's AI-generated response.
 * Uses a larger body limit (10mb) for messages that may include file uploads.
 */
router.post('/api/chat', express.json({ limit: '10mb' }), requireAuth, async (req, res) => {
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

    // Save user message to DB
    saveMessage(conversationId, {
      id: randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }, userId);

    const assistantMessage = await chat(conversationId, message);

    // Save assistant message to DB
    saveMessage(conversationId, assistantMessage);

    const response: ChatResponse = {
      conversationId,
      message: assistantMessage,
    };

    res.json(response);
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({
      error: 'Failed to get response from Kiki',
    });
  }
});

export default router;
