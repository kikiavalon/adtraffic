import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@adtraffic/shared';
import { KIKI_SYSTEM_PROMPT } from './system-prompt.js';
import { CM360_TOOLS } from './tool-definitions.js';

const anthropic = new Anthropic();

// In-memory conversation store (PostgreSQL replaces this later)
const conversations = new Map<string, Anthropic.MessageParam[]>();

/**
 * Send a message to Kiki and get a response.
 * Maintains conversation history per conversationId.
 */
export async function chat(
  conversationId: string,
  userMessage: string,
): Promise<ChatMessage> {
  // Get or create conversation history
  const history = conversations.get(conversationId) ?? [];

  // Add user message to history
  history.push({ role: 'user', content: userMessage });

  // Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: KIKI_SYSTEM_PROMPT,
    tools: CM360_TOOLS,
    messages: history,
  });

  // Extract text response (handle tool_use blocks later)
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  const responseText = textBlocks.map((b) => b.text).join('\n') || 'I need a moment to think about that.';

  // Add assistant response to history
  history.push({ role: 'assistant', content: response.content });

  // Save updated history
  conversations.set(conversationId, history);

  return {
    id: uuidv4(),
    role: 'assistant',
    content: responseText,
    timestamp: Date.now(),
  };
}

/**
 * Clear a conversation's history.
 */
export function clearConversation(conversationId: string): void {
  conversations.delete(conversationId);
}

/**
 * Get the number of messages in a conversation.
 * Useful for testing.
 */
export function getConversationLength(conversationId: string): number {
  return conversations.get(conversationId)?.length ?? 0;
}
