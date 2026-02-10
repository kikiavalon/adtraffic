import { Router } from 'express';
import type { Request } from 'express';
import { clearConversation } from '../claude/kiki-service.js';
import { requireAuth } from '../auth/middleware.js';
import { getConversations, getMessages } from '../db/conversation-store.js';

const router = Router();

/**
 * GET /api/conversations
 *
 * List all conversations for the authenticated user.
 */
router.get('/api/conversations', requireAuth, (req, res) => {
  const userId = (req as Request & { user: { userId: string } }).user.userId;
  const conversations = getConversations(userId);
  res.json({ conversations });
});

/**
 * GET /api/conversations/:id/messages
 *
 * Load all messages for a specific conversation.
 */
router.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  const id = req.params.id as string;
  const messages = getMessages(id);
  res.json({ messages });
});

/**
 * DELETE /api/conversations/:id
 *
 * Clears conversation history. Useful for "New Chat" functionality.
 */
router.delete('/api/conversations/:id', requireAuth, (req, res) => {
  const id = req.params.id as string;
  clearConversation(id);
  res.json({ success: true, conversationId: id });
});

export default router;
