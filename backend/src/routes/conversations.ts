import { Router } from 'express';
import { clearConversation } from '../claude/kiki-service.js';
import { requireAuth } from '../auth/middleware.js';
import { getConversations, getMessages, getConversation } from '../db/conversation-store.js';

const router = Router();

/**
 * GET /api/conversations
 *
 * List all conversations for the authenticated user.
 */
router.get('/api/conversations', requireAuth, (req, res) => {
  try {
    const userId = req.user!.userId;
    const conversations = getConversations(userId);
    res.json({ conversations });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /api/conversations/:id/messages
 *
 * Load all messages for a specific conversation.
 * Verifies the conversation belongs to the authenticated user.
 */
router.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;

    const conversation = getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conversation.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = getMessages(id);
    res.json({ messages });
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

/**
 * DELETE /api/conversations/:id
 *
 * Clears conversation history. Useful for "New Chat" functionality.
 * Verifies the conversation belongs to the authenticated user.
 */
router.delete('/api/conversations/:id', requireAuth, (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params['id'] as string;

    const conversation = getConversation(id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conversation.userId !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    clearConversation(id);
    res.json({ success: true, conversationId: id });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
