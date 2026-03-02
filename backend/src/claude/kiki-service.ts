import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, StreamEvent, FileAttachment } from '@adtraffic/shared';
import { getSystemPrompt } from './system-prompt.js';
import { CM360_TOOLS, getEnabledTools } from './tool-definitions.js';
import type { ResolvedFlags } from '../feature-flags/flag-registry.js';
import { executeTool } from '../cm360/tool-executor.js';
import { getHistory, saveHistory, clearHistory, getHistoryLength, saveMessage } from '../db/conversation-store.js';
import { checkLimit, recordUsage } from './usage-tracker.js';
import { prepareIOContent } from '../io/io-parser.js';
import { getExtractionPrompt } from '../io/extraction-prompt.js';
import { logger } from '../lib/logger.js';

const anthropic = new Anthropic();

const DEFAULT_MAX_TOOL_ROUNDS = 5;

// Configurable via env vars — defaults are cost-conscious for testing
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
const CLAUDE_MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '1024', 10);
const CLAUDE_IO_MODEL = process.env.CLAUDE_IO_MODEL ?? CLAUDE_MODEL;

/**
 * Send a message to Kiki and get a response.
 * Handles the full agentic loop: Claude may call tools multiple times
 * before producing a final text response.
 *
 * @param userId - When provided, tool calls attempt to use the real CM360 API.
 *                 When omitted, tool calls always use the mock data store.
 * @param flags - Optional resolved feature flags for the current user.
 *                Controls tool availability, daily limits, and max tool rounds.
 * @param attachment - Optional file attachment for IO extraction.
 */
export async function chat(
  conversationId: string,
  userMessage: string,
  userId?: string,
  flags?: ResolvedFlags,
  attachment?: FileAttachment,
): Promise<ChatMessage> {
  // Check if chat is enabled via feature flags
  if (flags && !flags['chat.enabled']) {
    return {
      id: uuidv4(),
      role: 'assistant',
      content: 'Chat is currently disabled for your account. Please contact support.',
      timestamp: Date.now(),
    };
  }

  const dailyLimit = flags?.['limits.daily_api_requests'];
  const maxToolRounds = flags?.['limits.max_tool_rounds'] ?? DEFAULT_MAX_TOOL_ROUNDS;
  const tools = flags ? getEnabledTools(flags) : CM360_TOOLS;

  // Check daily usage limit before making any API call
  const limitCheck = await checkLimit(dailyLimit);
  if (!limitCheck.allowed) {
    return {
      id: uuidv4(),
      role: 'assistant',
      content: limitCheck.message,
      timestamp: Date.now(),
    };
  }

  // Determine if user has live CM360 connection (lightweight DB check, no decryption)
  let isLiveData = false;
  if (userId) {
    try {
      const { hasOAuthTokens } = await import('../cm360/token-manager.js');
      isLiveData = await hasOAuthTokens(userId);
    } catch {
      // If import fails (e.g., in tests without DB), default to demo mode
    }
  }

  const history = await getHistory(conversationId);

  // Prepare IO content if attachment present
  let ioContentBlocks: Anthropic.ContentBlockParam[] | undefined;
  let useIOModel = false;
  if (attachment) {
    const ioContent = await prepareIOContent(attachment);
    ioContentBlocks = ioContent.contentBlocks;
    useIOModel = true;
  }

  // Build user message content — multimodal if attachment present
  if (ioContentBlocks && ioContentBlocks.length > 0) {
    const contentArray: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: userMessage },
      ...ioContentBlocks,
    ];
    history.push({ role: 'user', content: contentArray });
  } else {
    history.push({ role: 'user', content: userMessage });
  }

  let toolRounds = 0;

  try {
    while (toolRounds < maxToolRounds) {
      // Re-check limit before each API call (tool loops make multiple calls)
      const roundLimitCheck = await checkLimit(dailyLimit);
      if (!roundLimitCheck.allowed) {
        return {
          id: uuidv4(),
          role: 'assistant',
          content: roundLimitCheck.message,
          timestamp: Date.now(),
        };
      }

      // Use AbortController to enforce a 30-second timeout on Claude API calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let response: Anthropic.Message;
      try {
        response = await anthropic.messages.create(
          {
            model: useIOModel ? CLAUDE_IO_MODEL : CLAUDE_MODEL,
            max_tokens: useIOModel ? 4096 : CLAUDE_MAX_TOKENS,
            system: useIOModel
              ? getExtractionPrompt()
              : getSystemPrompt('Demo Agency', '67890', isLiveData),
            ...(useIOModel ? {} : { tools }),
            messages: history,
          },
          { signal: controller.signal },
        );
      } finally {
        clearTimeout(timeoutId);
      }

      // After first extraction call, revert to normal mode for subsequent rounds
      useIOModel = false;

      // Record token usage
      await recordUsage(
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

        return {
          id: uuidv4(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        };
      }

      // Execute tool calls in parallel and build tool_result blocks
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            userId,
          );

          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify(result.result),
            is_error: result.isError,
          };
        }),
      );

      // Add tool results to history
      history.push({ role: 'user', content: toolResults });

      toolRounds++;
    }

    // If we hit the max rounds, extract whatever text we have
    return {
      id: uuidv4(),
      role: 'assistant',
      content: 'I ran into a limit processing your request. Could you try rephrasing or breaking it into smaller steps?',
      timestamp: Date.now(),
    };
  } finally {
    // Always persist history — even on errors, timeouts, or early returns
    await saveHistory(conversationId, history);
  }
}

/**
 * Send a message to Kiki and stream the response via SSE events.
 * Handles the full agentic loop with real-time streaming of text deltas
 * and tool execution status.
 */
export async function chatStream(
  conversationId: string,
  userMessage: string,
  emit: (event: StreamEvent) => void,
  signal: AbortSignal,
  userId?: string,
  flags?: ResolvedFlags,
  attachment?: FileAttachment,
): Promise<void> {
  // Check if chat is enabled via feature flags
  if (flags && !flags['chat.enabled']) {
    const messageId = uuidv4();
    emit({ type: 'message_start', messageId, conversationId });
    const disabledContent = 'Chat is currently disabled for your account. Please contact support.';
    emit({ type: 'content_delta', delta: disabledContent });
    const disabledMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: disabledContent,
      timestamp: Date.now(),
    };
    await saveMessage(conversationId, disabledMessage);
    emit({ type: 'message_end', message: disabledMessage });
    return;
  }

  const maxToolRounds = flags?.['limits.max_tool_rounds'] ?? DEFAULT_MAX_TOOL_ROUNDS;
  const dailyLimit = flags?.['limits.daily_api_requests'];
  const tools = flags ? getEnabledTools(flags) : CM360_TOOLS;

  // Check daily usage limit before making any API call
  const limitCheck = await checkLimit(dailyLimit);
  if (!limitCheck.allowed) {
    const messageId = uuidv4();
    emit({ type: 'message_start', messageId, conversationId });
    emit({ type: 'content_delta', delta: limitCheck.message });
    const limitMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: limitCheck.message,
      timestamp: Date.now(),
    };
    await saveMessage(conversationId, limitMessage);
    emit({ type: 'message_end', message: limitMessage });
    return;
  }

  // Determine if user has live CM360 connection
  let isLiveData = false;
  if (userId) {
    try {
      const { hasOAuthTokens } = await import('../cm360/token-manager.js');
      isLiveData = await hasOAuthTokens(userId);
    } catch {
      // If import fails (e.g., in tests without DB), default to demo mode
    }
  }

  const history = await getHistory(conversationId);

  // Prepare IO content if attachment present
  let useIOModel = false;
  if (attachment) {
    const ioContent = await prepareIOContent(attachment);
    const ioContentBlocks = ioContent.contentBlocks;
    if (ioContentBlocks.length > 0) {
      const contentArray: Anthropic.ContentBlockParam[] = [
        { type: 'text', text: userMessage },
        ...ioContentBlocks,
      ];
      history.push({ role: 'user', content: contentArray });
    } else {
      history.push({ role: 'user', content: userMessage });
    }
    useIOModel = true;
  } else {
    history.push({ role: 'user', content: userMessage });
  }

  const messageId = uuidv4();
  emit({ type: 'message_start', messageId, conversationId });

  logger.debug({
    conversationId,
    maxToolRounds,
    maxTokens: CLAUDE_MAX_TOKENS,
    model: CLAUDE_MODEL,
    toolCount: tools.length,
    isLiveData,
  }, 'chatStream starting');

  let toolRounds = 0;
  let accumulatedText = '';

  try {
    while (toolRounds < maxToolRounds) {
      // Re-check limit before each API call (tool loops make multiple calls)
      const roundLimitCheck = await checkLimit(dailyLimit);
      if (!roundLimitCheck.allowed) {
        const limitMsg: ChatMessage = {
          id: messageId,
          role: 'assistant',
          content: accumulatedText || roundLimitCheck.message,
          timestamp: Date.now(),
        };
        emit({ type: 'message_end', message: limitMsg });
        return;
      }

      // Streaming call to Claude
      const stream = anthropic.messages.stream(
        {
          model: useIOModel ? CLAUDE_IO_MODEL : CLAUDE_MODEL,
          max_tokens: useIOModel ? 4096 : CLAUDE_MAX_TOKENS,
          system: useIOModel
            ? getExtractionPrompt()
            : getSystemPrompt('Demo Agency', '67890', isLiveData),
          ...(useIOModel ? {} : { tools }),
          messages: history,
        },
        { signal },
      );

      // After first extraction call, revert to normal mode for subsequent rounds
      useIOModel = false;

      // Process stream events — emit text deltas as they arrive
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            emit({ type: 'content_delta', delta: event.delta.text });
            accumulatedText += event.delta.text;
          }
          // Ignore input_json_delta — no user-facing value in streaming partial tool inputs
        }
      }

      // After stream completes, get the final message for tool_use detection and usage
      const finalMessage = await stream.finalMessage();

      // Record token usage
      await recordUsage(
        CLAUDE_MODEL,
        finalMessage.usage?.input_tokens ?? 0,
        finalMessage.usage?.output_tokens ?? 0,
      );

      // Add assistant response to history
      history.push({ role: 'assistant', content: finalMessage.content });

      // Check for tool_use blocks
      const toolUseBlocks = finalMessage.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      logger.debug({
        toolRound: toolRounds,
        stopReason: finalMessage.stop_reason,
        toolUseCount: toolUseBlocks.length,
        toolNames: toolUseBlocks.map((b: Anthropic.ToolUseBlock) => b.name),
        outputTokens: finalMessage.usage?.output_tokens,
        accumulatedTextLength: accumulatedText.length,
      }, 'chatStream round completed');

      if (toolUseBlocks.length === 0 || finalMessage.stop_reason === 'end_turn') {
        // No tools — emit final message
        const responseText = accumulatedText || 'I need a moment to think about that.';
        const chatMessage: ChatMessage = {
          id: messageId,
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        };
        await saveMessage(conversationId, chatMessage);
        emit({ type: 'message_end', message: chatMessage });
        return;
      }

      // Execute tools sequentially with status events for user visibility
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
        is_error: boolean;
      }> = [];

      for (const toolUse of toolUseBlocks) {
        emit({ type: 'tool_start', toolName: toolUse.name, toolUseId: toolUse.id });
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          userId,
        );
        emit({
          type: 'tool_end',
          toolUseId: toolUse.id,
          toolName: toolUse.name,
          success: !result.isError,
        });
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.result),
          is_error: result.isError,
        });
      }

      // Add tool results to history
      history.push({ role: 'user', content: toolResults });

      // Reset accumulated text for next Claude response
      accumulatedText = '';
      toolRounds++;
    }

    // Hit max rounds — emit whatever we have
    const maxRoundsText = accumulatedText ||
      'I ran into a limit processing your request. Could you try rephrasing or breaking it into smaller steps?';
    const maxRoundsMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: maxRoundsText,
      timestamp: Date.now(),
    };
    await saveMessage(conversationId, maxRoundsMessage);
    emit({ type: 'message_end', message: maxRoundsMessage });
  } finally {
    // Always persist history — even on errors, timeouts, or early returns
    await saveHistory(conversationId, history);
  }
}

/**
 * Clear a conversation's history.
 */
export async function clearConversation(conversationId: string): Promise<void> {
  await clearHistory(conversationId);
}

/**
 * Get the number of messages in a conversation.
 */
export async function getConversationLength(conversationId: string): Promise<number> {
  return await getHistoryLength(conversationId);
}
