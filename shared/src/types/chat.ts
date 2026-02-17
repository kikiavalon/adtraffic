/**
 * Chat message types shared between extension and backend.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** File attachment (IO upload) */
  attachment?: FileAttachment;
  /** Quick-select options presented by Kiki */
  options?: QuickSelectOption[];
  /** Tool calls Kiki is requesting the extension to execute */
  toolCalls?: CM360ToolCall[];
}

export interface FileAttachment {
  name: string;
  type: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'application/vnd.ms-excel' | 'text/csv';
  /** Base64-encoded file content */
  data: string;
  sizeBytes: number;
}

export interface QuickSelectOption {
  id: string;
  label: string;
  value: string;
}

export interface CM360ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface CM360ToolResult {
  toolCallId: string;
  result: unknown;
  isError: boolean;
  errorMessage?: string;
}

/** Request from extension to backend */
export interface ChatRequest {
  conversationId: string;
  message: string;
  attachment?: FileAttachment;
  toolResults?: CM360ToolResult[];
}

/** Response from backend to extension */
export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
}

/** Build preview that Kiki shows before executing writes */
export interface BuildPreview {
  description: string;
  operations: BuildOperation[];
  totalOperations: number;
}

export interface BuildOperation {
  type: 'create' | 'update' | 'rename';
  resource: import('./cm360.js').CM360BuildResource;
  summary: string;
  details: Record<string, unknown>;
}
