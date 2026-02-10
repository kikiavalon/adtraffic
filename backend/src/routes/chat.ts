import { Router } from 'express';
import { ChatRequestSchema } from '@adtraffic/shared';
import type { ChatResponse } from '@adtraffic/shared';
import { chat } from '../claude/kiki-service.js';

const router = Router();

/**
 * POST /api/chat
 *
 * Receives a user message, forwards to Claude API via Kiki service,
 * returns Kiki's AI-generated response.
 */
router.post('/api/chat', async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.issues,
    });
    return;
  }

  const { conversationId, message } = parsed.data;

  try {
    const assistantMessage = await chat(conversationId, message);

    const response: ChatResponse = {
      conversationId,
      message: assistantMessage,
    };

    res.json(response);
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({
      error: 'Failed to get response from Kiki',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
