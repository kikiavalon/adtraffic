import { Router } from 'express';
import { clearConversation } from '../claude/kiki-service.js';

const router = Router();

/**
 * DELETE /api/conversations/:id
 *
 * Clears conversation history. Useful for "New Chat" functionality.
 */
router.delete('/api/conversations/:id', (req, res) => {
  const { id } = req.params;
  clearConversation(id);
  res.json({ success: true, conversationId: id });
});

export default router;
