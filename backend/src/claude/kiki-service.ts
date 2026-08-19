import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, StreamEvent, FileAttachment, ActionPreview, QARunReport } from '@adtraffic/shared';
import { getSystemPrompt } from './system-prompt.js';
import { CM360_TOOLS, getEnabledTools, STUBBED_TOOLS } from './tool-definitions.js';
import type { ResolvedFlags } from '../feature-flags/flag-registry.js';
import { executeTool } from '../cm360/tool-executor.js';
import { classifyTool } from '../cm360/write-classifier.js';
import { createPendingAction } from '../cm360/pending-actions.js';
import { analyzeImpact } from '../cm360/impact-analyzer.js';
import { submitForApproval } from '../approval/approval-service.js';
import { isValidRole, hasPermission } from '../auth/roles.js';
import { getHistory, saveHistory, clearHistory, getHistoryLength, saveMessage } from '../db/conversation-store.js';
import { checkLimit, recordUsage } from './usage-tracker.js';
import { prepareIOContent } from '../io/io-parser.js';
import { getExtractionPrompt } from '../io/extraction-prompt.js';
import { logger } from '../lib/logger.js';
import { withRetry } from './retry.js';
import { runTurnQa } from '../qa/qa-service.js';
import { drainQaWrites } from '../qa/qa-recorder.js';
import { getDecryptedKey, NoAnthropicKeyError } from './anthropic-key-service.js';

/**
 * Trafficking QA end-of-turn trigger — advisory, never throws, never blocks the reply.
 * Returns the report for SSE emission; the non-streaming path persists silently.
 */
async function maybeRunTurnQa(
  conversationId: string,
  userId: string | undefined,
  flags: ResolvedFlags | undefined,
): Promise<QARunReport | null> {
  if (!userId) return null;
  try {
    return await runTurnQa({ conversationId, userId, flags, trigger: 'auto' });
  } catch (err) {
    logger.warn(
      { err: { message: err instanceof Error ? err.message : 'Unknown' }, conversationId },
      'Trafficking QA end-of-turn trigger failed',
    );
    return null;
  }
}

const DEFAULT_MAX_TOOL_ROUNDS = 5;

// Configurable via env vars — defaults are cost-conscious for testing
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
const CLAUDE_MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '1024', 10);
const CLAUDE_IO_MODEL = process.env.CLAUDE_IO_MODEL ?? CLAUDE_MODEL;

/**
 * Build an Anthropic client from the requesting user's own encrypted API key.
 * Each request sources its client per-user rather than sharing one process-wide
 * client, so users are billed on their own key and a missing key fails fast.
 *
 * @throws NoAnthropicKeyError when no userId is provided or the user has no key.
 */
export async function getUserAnthropicClient(userId: string | undefined): Promise<Anthropic> {
  // Always consult the key service. In production the chat route always passes a
  // real userId; an absent one resolves to null (getDecryptedKey short-circuits an
  // empty id) and throws NoAnthropicKeyError below. Either way the server-wide key
  // never enters the chat path.
  const key = await getDecryptedKey(userId ?? '');
  if (!key) throw new NoAnthropicKeyError();
  return new Anthropic({ apiKey: key });
}

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
 * @param userRole - The authenticated user's role (admin/senior/junior).
 *                   Junior users have write ops routed to the approval queue.
 */
export async function chat(
  conversationId: string,
  userMessage: string,
  userId?: string,
  flags?: ResolvedFlags,
  attachment?: FileAttachment,
  userRole?: string,
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
  const maxToolRounds = Math.min(flags?.['limits.max_tool_rounds'] ?? DEFAULT_MAX_TOOL_ROUNDS, 10);
  const enabledTools = flags ? getEnabledTools(flags) : CM360_TOOLS;

  // Check daily usage limit before making any API call
  const limitCheck = await checkLimit(dailyLimit, userId);
  if (!limitCheck.allowed) {
    return {
      id: uuidv4(),
      role: 'assistant',
      content: limitCheck.message,
      timestamp: Date.now(),
    };
  }

  // Build the per-user Anthropic client (throws NoAnthropicKeyError if the user
  // has no connected key). Placed after the friendly short-circuit returns above.
  const anthropic = await getUserAnthropicClient(userId);

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

  // Filter out stubbed tools when user has a live CM360 connection
  const tools = isLiveData
    ? enabledTools.filter(t => !STUBBED_TOOLS.has(t.name))
    : enabledTools;

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
      const roundLimitCheck = await checkLimit(dailyLimit, userId);
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
        response = await withRetry(
          () => anthropic.messages.create(
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
          ),
          { maxRetries: 2, baseDelayMs: 500, signal: controller.signal },
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
        userId,
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

        await maybeRunTurnQa(conversationId, userId, flags);

        return {
          id: uuidv4(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        };
      }

      // Execute tool calls — intercept write tools with confirmation gate or approval queue
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          const toolInput = toolUse.input as Record<string, unknown>;
          const riskLevel = classifyTool(toolUse.name, toolInput);

          if (riskLevel !== null) {
            // Write tool detected — check user role
            const requiresApproval = userRole && isValidRole(userRole) && hasPermission(userRole, 'requiresApproval');

            if (requiresApproval) {
              // Junior user — route to approval queue instead of confirmation card
              const preview = buildActionPreview(toolUse.name, toolInput);
              const pendingActionPayload = {
                actionId: crypto.randomUUID(),
                toolName: toolUse.name,
                // The approvals route executes the stored payload after sign-off,
                // so it must carry the original tool input (as the confirmations
                // route does via StoredPendingAction).
                toolInput,
                description: `${preview.operation} ${preview.entityType}: ${preview.entityName}`,
                preview,
                riskLevel,
                proposedAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h for approval queue items
              };

              await submitForApproval(userId ?? 'anonymous', pendingActionPayload, conversationId);

              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  status: 'submitted_for_approval',
                  message: `This ${preview.operation} operation has been submitted to the approval queue for review by a senior team member. You will be notified once it is approved or rejected.`,
                }),
                is_error: false,
              };
            }

            // Senior/admin user — intercept with confirmation gate
            const preview = buildActionPreview(toolUse.name, toolInput);

            // Add downstream impact warnings for elevated/destructive operations
            if (riskLevel === 'elevated' || riskLevel === 'destructive') {
              const impactWarnings = await analyzeImpact(toolUse.name, toolInput, userId, isLiveData);
              if (impactWarnings.length > 0) {
                preview.warnings = [...(preview.warnings ?? []), ...impactWarnings];
              }
            }

            const pendingAction = await createPendingAction({
              userId: userId ?? 'anonymous',
              conversationId,
              toolName: toolUse.name,
              toolInput,
              description: `${preview.operation} ${preview.entityType}: ${preview.entityName}`,
              preview,
              riskLevel,
            });

            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                status: 'awaiting_confirmation',
                message: `This ${preview.operation} operation requires user confirmation before proceeding. The user has been shown a confirmation dialog. Please wait for their response before continuing.`,
                actionId: pendingAction.actionId,
              }),
              is_error: false,
            };
          }

          // Read tool — execute normally
          const result = await executeTool(
            toolUse.name,
            toolInput,
            userId,
            conversationId,
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
    await maybeRunTurnQa(conversationId, userId, flags);
    return {
      id: uuidv4(),
      role: 'assistant',
      content: 'I ran into a limit processing your request. Could you try rephrasing or breaking it into smaller steps?',
      timestamp: Date.now(),
    };
  } finally {
    // Always persist history — even on errors, timeouts, or early returns
    await saveHistory(conversationId, history);
    // Discard any writes recorded this turn that the end-of-turn trigger did not
    // consume (mid-stream abort, error, or a path that skipped QA). A leftover
    // entry would otherwise be inherited — and misattributed — by the next turn
    // of this conversation that happens to land on this replica.
    drainQaWrites(conversationId);
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
  userRole?: string,
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

  const maxToolRounds = Math.min(flags?.['limits.max_tool_rounds'] ?? DEFAULT_MAX_TOOL_ROUNDS, 10);
  const dailyLimit = flags?.['limits.daily_api_requests'];
  const enabledTools = flags ? getEnabledTools(flags) : CM360_TOOLS;

  // Check daily usage limit before making any API call
  const limitCheck = await checkLimit(dailyLimit, userId);
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

  // Build the per-user Anthropic client before any streaming begins, so a missing
  // key throws NoAnthropicKeyError synchronously from chatStream() (the caller maps
  // it to an SSE error). Placed after the friendly short-circuit returns above.
  const anthropic = await getUserAnthropicClient(userId);

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

  // Filter out stubbed tools when user has a live CM360 connection
  const tools = isLiveData
    ? enabledTools.filter(t => !STUBBED_TOOLS.has(t.name))
    : enabledTools;

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
      const roundLimitCheck = await checkLimit(dailyLimit, userId);
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

      // Streaming call to Claude (with retry on transient connection errors).
      // NOTE: withRetry only catches errors thrown during stream initialization.
      // Mid-stream failures (e.g., network drop during iteration) are not retried
      // because the stream object resolves immediately. A full streaming retry
      // would require wrapping the entire for-await loop, which is a larger refactor.
      const stream = await withRetry(
        () => Promise.resolve(anthropic.messages.stream(
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
        )),
        { maxRetries: 2, baseDelayMs: 500, signal },
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
        userId,
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
        const qaReport = await maybeRunTurnQa(conversationId, userId, flags);
        if (qaReport) emit({ type: 'qa_report', report: qaReport });
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

      // Execute tools sequentially — intercept write tools with confirmation gate
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
        is_error: boolean;
      }> = [];

      for (const toolUse of toolUseBlocks) {
        const toolInput = toolUse.input as Record<string, unknown>;
        const riskLevel = classifyTool(toolUse.name, toolInput);

        if (riskLevel !== null) {
          // Write tool detected — check user role
          const requiresApproval = userRole && isValidRole(userRole) && hasPermission(userRole, 'requiresApproval');

          if (requiresApproval) {
            // Junior user — route to approval queue instead of confirmation card
            const preview = buildActionPreview(toolUse.name, toolInput);
            const pendingActionPayload = {
              actionId: crypto.randomUUID(),
              toolName: toolUse.name,
              // The approvals route executes the stored payload after sign-off,
              // so it must carry the original tool input (as the confirmations
              // route does via StoredPendingAction).
              toolInput,
              description: `${preview.operation} ${preview.entityType}: ${preview.entityName}`,
              preview,
              riskLevel,
              proposedAt: Date.now(),
              expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h for approval queue items
            };

            await submitForApproval(userId ?? 'anonymous', pendingActionPayload, conversationId);

            // Emit an approval_submitted event for the frontend
            emit({ type: 'approval_submitted', action: pendingActionPayload });

            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                status: 'submitted_for_approval',
                message: `This ${preview.operation} operation has been submitted to the approval queue for review by a senior team member. You will be notified once it is approved or rejected.`,
              }),
              is_error: false,
            });
            continue; // Skip actual execution
          }

          // Senior/admin user — intercept with confirmation gate
          const preview = buildActionPreview(toolUse.name, toolInput);

          // Add downstream impact warnings for elevated/destructive operations
          if (riskLevel === 'elevated' || riskLevel === 'destructive') {
            const impactWarnings = await analyzeImpact(toolUse.name, toolInput, userId, isLiveData);
            if (impactWarnings.length > 0) {
              preview.warnings = [...(preview.warnings ?? []), ...impactWarnings];
            }
          }

          const pendingAction = await createPendingAction({
            userId: userId ?? 'anonymous',
            conversationId,
            toolName: toolUse.name,
            toolInput,
            description: `${preview.operation} ${preview.entityType}: ${preview.entityName}`,
            preview,
            riskLevel,
          });

          // Emit confirmation_required event for the frontend
          emit({ type: 'confirmation_required', action: pendingAction });

          // Return a tool_result that tells Claude the operation is awaiting confirmation
          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              status: 'awaiting_confirmation',
              message: `This ${preview.operation} operation requires user confirmation before proceeding. The user has been shown a confirmation dialog. Please wait for their response before continuing.`,
              actionId: pendingAction.actionId,
            }),
            is_error: false,
          });
          continue; // Skip actual execution
        }

        // Read tool — execute normally
        emit({ type: 'tool_start', toolName: toolUse.name, toolUseId: toolUse.id });
        const result = await executeTool(
          toolUse.name,
          toolInput,
          userId,
          conversationId,
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
    const maxRoundsQaReport = await maybeRunTurnQa(conversationId, userId, flags);
    if (maxRoundsQaReport) emit({ type: 'qa_report', report: maxRoundsQaReport });
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
    // Discard any writes recorded this turn that the end-of-turn trigger did not
    // consume (mid-stream abort, error, or a path that skipped QA). A leftover
    // entry would otherwise be inherited — and misattributed — by the next turn
    // of this conversation that happens to land on this replica.
    drainQaWrites(conversationId);
  }
}

/**
 * Build a structured preview of a proposed write operation for the confirmation card.
 * Maps tool names to entity types and operations, extracts relevant fields,
 * and generates warnings for destructive operations.
 */
export function buildActionPreview(toolName: string, input: Record<string, unknown>): ActionPreview {
  // Map tool names to entity types
  const entityTypeMap: Record<string, string> = {
    cm360_create_campaign: 'Campaign',
    cm360_create_placement: 'Placement',
    cm360_create_landing_page: 'Landing Page',
    cm360_create_creative: 'Creative',
    cm360_create_ad: 'Ad',
    cm360_associate_creative_campaign: 'Creative-Campaign Association',
    cm360_upload_creative_asset: 'Creative Asset',
    cm360_update_campaign: 'Campaign',
    cm360_update_placement: 'Placement',
    cm360_update_ad: 'Ad',
    cm360_update_creative: 'Creative',
    cm360_update_landing_page: 'Landing Page',
    cm360_create_event_tag: 'Event Tag',
    cm360_update_event_tag: 'Event Tag',
    cm360_create_placement_group: 'Placement Group',
    cm360_update_placement_group: 'Placement Group',
    cm360_insert_directory_site: 'Directory Site',
    cm360_create_floodlight_activity: 'Floodlight Activity',
    cm360_create_floodlight_activity_group: 'Floodlight Activity Group',
    cm360_create_report: 'Report',
    cm360_run_report: 'Report Run',
    cm360_create_account_user_profile: 'Account User Profile',
    cm360_create_user_role: 'User Role',
  };

  // Map verb prefixes to operation types
  const operationMap: Record<string, ActionPreview['operation']> = {
    create: 'create',
    update: 'update',
    associate: 'create',
    upload: 'create',
    insert: 'create',
    run: 'create',
  };

  const entityType = entityTypeMap[toolName] ?? 'Entity';

  // Determine operation from tool name: cm360_CREATE_campaign → 'create'
  const parts = toolName.split('_');
  const verb = parts.length >= 2 ? parts[1]! : 'update';
  let operation: ActionPreview['operation'] = operationMap[verb] ?? 'update';

  // Check for archive operations (escalate to 'archive')
  if (
    input.archived === true ||
    input.activeStatus === 'ARCHIVED' ||
    input.activeStatus === 'PERMANENTLY_ARCHIVED' ||
    input.activeStatus === 'INACTIVE'
  ) {
    operation = 'archive';
  }

  // Determine entity name from input — try common field names
  const entityName =
    (input.name as string | undefined) ??
    (input.campaignId as string | undefined) ??
    (input.placementId as string | undefined) ??
    (input.adId as string | undefined) ??
    (input.creativeId as string | undefined) ??
    (input.landingPageId as string | undefined) ??
    (input.assetName as string | undefined) ??
    'Unknown';

  // Build fields for create operations
  const fields: Array<{ field: string; value: string }> = [];
  const changes: Array<{ field: string; from?: string; to: string }> = [];

  if (operation === 'create') {
    for (const [key, val] of Object.entries(input)) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        fields.push({ field: key, value: String(val) });
      }
    }
  } else {
    // For updates/archive/delete, list changed fields (exclude metadata fields)
    for (const [key, val] of Object.entries(input)) {
      if (key === 'profileId' || key === 'id') continue;
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        changes.push({ field: key, to: String(val) });
      }
    }
  }

  const warnings: string[] = [];
  if (input.activeStatus === 'PERMANENTLY_ARCHIVED') {
    warnings.push('This action CANNOT be undone.');
  }
  if (input.archived === true) {
    warnings.push('Archiving this entity may affect associated placements and ads.');
  }

  return {
    entityType,
    entityName,
    operation,
    ...(fields.length > 0 ? { fields } : {}),
    ...(changes.length > 0 ? { changes } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
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
