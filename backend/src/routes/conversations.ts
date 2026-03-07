import { Router } from 'express';
import { clearConversation } from '../claude/kiki-service.js';
import { requireAuth } from '../auth/middleware.js';
import { getConversations, getMessages, getConversation } from '../db/conversation-store.js';
import { logger } from '../lib/logger.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { featureFlagsMiddleware } from '../feature-flags/flag-middleware.js';

const router = Router();

const deleteConversationLimiter = createRateLimiter({ name: 'delete-conversation', windowMs: 60_000, maxRequests: 10 });

/**
 * GET /conversations
 *
 * List conversations for the authenticated user with pagination.
 * Query params: ?limit=50&offset=0
 */
router.get('/conversations', requireAuth, featureFlagsMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.max(1, Math.min(200, parseInt(req.query['limit'] as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query['offset'] as string, 10) || 0);
    const conversations = await getConversations(userId, limit, offset);
    res.json({ conversations });
  } catch (error) {
    logger.error({ err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId }, 'Error listing conversations');
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /conversations/:id/messages
 *
 * Load all messages for a specific conversation.
 * Verifies the conversation belongs to the authenticated user.
 */
router.get('/conversations/:id/messages', requireAuth, featureFlagsMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;

    const conversation = await getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conversation.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const limit = Math.max(1, Math.min(500, parseInt(req.query['limit'] as string, 10) || 100));
    const offset = Math.max(0, parseInt(req.query['offset'] as string, 10) || 0);
    const messages = await getMessages(id, limit, offset);
    res.json({ messages });
  } catch (error) {
    logger.error({ err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId }, 'Error loading messages');
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

/**
 * DELETE /conversations/:id
 *
 * Clears conversation history. Useful for "New Chat" functionality.
 * Verifies the conversation belongs to the authenticated user.
 */
router.delete('/conversations/:id', deleteConversationLimiter, requireAuth, featureFlagsMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;

    const conversation = await getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conversation.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await clearConversation(id);
    res.json({ success: true, conversationId: id });
  } catch (error) {
    logger.error({ err: { message: error instanceof Error ? error.message : 'Unknown error' }, requestId: req.requestId }, 'Error deleting conversation');
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
