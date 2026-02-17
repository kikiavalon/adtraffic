import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@adtraffic/shared';
import { KIKI_SYSTEM_PROMPT } from './system-prompt.js';
import { CM360_TOOLS } from './tool-definitions.js';
import { executeTool } from '../cm360/tool-executor.js';
import { getHistory, saveHistory, clearHistory, getHistoryLength } from '../db/conversation-store.js';
import { checkLimit, recordUsage } from './usage-tracker.js';

const anthropic = new Anthropic();

const MAX_TOOL_ROUNDS = 5;

// Configurable via env vars — defaults are cost-conscious for testing
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
const CLAUDE_MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '1024', 10);

/**
 * Send a message to Kiki and get a response.
 * Handles the full agentic loop: Claude may call tools multiple times
 * before producing a final text response.
 */
export async function chat(
  conversationId: string,
  userMessage: string,
): Promise<ChatMessage> {
  // Check daily usage limit before making any API call
  const limitCheck = checkLimit();
  if (!limitCheck.allowed) {
    return {
      id: uuidv4(),
      role: 'assistant',
      content: limitCheck.message!,
      timestamp: Date.now(),
    };
  }

  const history = getHistory(conversationId);

  history.push({ role: 'user', content: userMessage });

  let toolRounds = 0;

  while (toolRounds < MAX_TOOL_ROUNDS) {
    // Re-check limit before each API call (tool loops make multiple calls)
    const roundLimitCheck = checkLimit();
    if (!roundLimitCheck.allowed) {
      saveHistory(conversationId, history);
      return {
        id: uuidv4(),
        role: 'assistant',
        content: roundLimitCheck.message!,
        timestamp: Date.now(),
      };
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: KIKI_SYSTEM_PROMPT,
      tools: CM360_TOOLS,
      messages: history,
    });

    // Record token usage
    recordUsage(
      CLAUDE_MODEL,
      response.usage?.input_tokens ?? 0,
      response.usage?.output_tokens ?? 0,
    );

    // Add assistant response to history
    history.push({ role: 'assistant', content: response.content });

    // Check if Claude wants to use tools
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // No tool calls — extract text and return
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      const responseText = textBlocks.map((b) => b.text).join('\n') || 'I need a moment to think about that.';

      saveHistory(conversationId, history);

      return {
        id: uuidv4(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      };
    }

    // Execute each tool call and build tool_result blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
      );

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result.result),
        is_error: result.isError,
      });
    }

    // Add tool results to history
    history.push({ role: 'user', content: toolResults });

    toolRounds++;
  }

  // If we hit the max rounds, extract whatever text we have
  saveHistory(conversationId, history);

  return {
    id: uuidv4(),
    role: 'assistant',
    content: 'I ran into a limit processing your request. Could you try rephrasing or breaking it into smaller steps?',
    timestamp: Date.now(),
  };
}

/**
 * Clear a conversation's history.
 */
export function clearConversation(conversationId: string): void {
  clearHistory(conversationId);
}

/**
 * Get the number of messages in a conversation.
 */
export function getConversationLength(conversationId: string): number {
  return getHistoryLength(conversationId);
}
