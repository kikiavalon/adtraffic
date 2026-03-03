/**
 * SSE streaming event types for real-time chat responses.
 *
 * Sent from the backend POST /api/chat/stream endpoint to the frontend.
 * Each event is serialized as an SSE `data:` line with a corresponding `event:` type.
 */

import type { ChatMessage } from './chat.js';
import type { PendingAction } from './confirmation.js';

/** Discriminated union of all SSE event types */
export type StreamEvent =
  | StreamMessageStart
  | StreamContentDelta
  | StreamToolStart
  | StreamToolEnd
  | StreamMessageEnd
  | StreamRetrying
  | StreamConfirmationRequired
  | StreamApprovalSubmitted
  | StreamError
  | StreamDone;

/** Sent once at the beginning — establishes message ID and conversation */
export interface StreamMessageStart {
  type: 'message_start';
  messageId: string;
  conversationId: string;
}

/** Streamed text chunks as they arrive from Claude */
export interface StreamContentDelta {
  type: 'content_delta';
  delta: string;
}

/** Claude requested a tool call — frontend shows tool status */
export interface StreamToolStart {
  type: 'tool_start';
  toolName: string;
  toolUseId: string;
}

/** Tool execution completed */
export interface StreamToolEnd {
  type: 'tool_end';
  toolUseId: string;
  toolName: string;
  success: boolean;
}

/** Final complete message — source of truth, replaces incremental content */
export interface StreamMessageEnd {
  type: 'message_end';
  message: ChatMessage;
}

/** Backend is retrying a transient error — frontend should keep loading state */
export interface StreamRetrying {
  type: 'retrying';
  attempt: number;
  maxAttempts: number;
  delayMs: number;
}

/** Write tool requires user confirmation before execution */
export interface StreamConfirmationRequired {
  type: 'confirmation_required';
  action: PendingAction;
}

/** Write tool was submitted to the approval queue (junior users) */
export interface StreamApprovalSubmitted {
  type: 'approval_submitted';
  action: PendingAction;
}

/** Error during streaming */
export interface StreamError {
  type: 'error';
  error: string;
  code?: number;
}

/** Stream is finished — frontend can close the connection */
export interface StreamDone {
  type: 'done';
}
