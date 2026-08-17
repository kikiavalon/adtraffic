/**
 * Trafficking QA — the ONLY data-access path for QA code.
 *
 * Read-only invariant (design §4): nothing in the QA path may call a mutating
 * tool. Enforced here with an explicit allowlist + name-shape guard, and proven
 * by test. Reads route through executeTool, inheriting live/mock/demo routing,
 * CM360 rate limiting, session cache, and audit logging.
 */

import { executeTool, type ToolResult } from '../cm360/tool-executor.js';

export const QA_READ_ALLOWLIST: ReadonlySet<string> = new Set([
  'cm360_get_campaign',
  'cm360_get_advertiser',
  'cm360_get_ad',
  'cm360_list_ads',
  'cm360_get_placement',
  'cm360_list_placements',
  'cm360_get_landing_page',
  'cm360_list_landing_pages',
  'cm360_get_creative',
  'cm360_list_creatives',
]);

/** Read-only tools that don't match the list/get name shape but mutate nothing:
 * cm360_generate_tags only EXPORTS tag strings (executor cases tool-executor.ts:714/1683;
 * isMutatingTool's regex covers create/update/delete/upload/associate only).
 * Phase 2's live click test needs the real exported clickTag. Keep this set tiny. */
export const QA_READ_EXTRA: ReadonlySet<string> = new Set(['cm360_generate_tags']);

export class QAReadOnlyViolationError extends Error {
  constructor(toolName: string) {
    super(`QA is strictly read-only: refusing to execute "${toolName}" (not on the QA read allowlist)`);
    this.name = 'QAReadOnlyViolationError';
  }
}

export async function qaRead(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId?: string,
  conversationId?: string,
): Promise<ToolResult> {
  const isAllowlistedRead = QA_READ_ALLOWLIST.has(toolName) && /^cm360_(list|get)_/.test(toolName);
  if (!isAllowlistedRead && !QA_READ_EXTRA.has(toolName)) {
    throw new QAReadOnlyViolationError(toolName);
  }
  return executeTool(toolName, toolInput, userId, conversationId);
}
