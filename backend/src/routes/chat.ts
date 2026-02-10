import { Router } from 'express';
import { ChatRequestSchema } from '@adtraffic/shared';
import type { ChatResponse, ChatMessage } from '@adtraffic/shared';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/chat
 *
 * Receives a chat message from the extension, forwards to Claude API,
 * returns Kiki's response. Claude integration is stubbed for Task 4 —
 * will be implemented in Task 6.
 */
router.post('/api/chat', (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.issues,
    });
    return;
  }

  const { conversationId, message } = parsed.data;

  // Stub response — Claude integration comes in Task 6
  const assistantMessage: ChatMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: `I'm Kiki! I received your message: "${message}". Claude integration coming soon.`,
    timestamp: Date.now(),
  };

  const response: ChatResponse = {
    conversationId,
    message: assistantMessage,
  };

  res.json(response);
});

export default router;
