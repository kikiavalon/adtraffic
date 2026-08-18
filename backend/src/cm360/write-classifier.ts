import type { OperationRiskLevel } from '@adtraffic/shared';

/** Map of write tool names to their base risk level */
export const WRITE_TOOL_RISK_MAP: Record<string, OperationRiskLevel> = {
  // Create operations — standard risk
  cm360_create_campaign: 'standard',
  cm360_create_placement: 'standard',
  cm360_create_landing_page: 'standard',
  cm360_create_creative: 'standard',
  cm360_create_ad: 'standard',
  cm360_associate_creative_campaign: 'standard',
  cm360_upload_creative_asset: 'standard',
  cm360_create_event_tag: 'standard',
  cm360_create_placement_group: 'standard',
  cm360_insert_directory_site: 'standard',
  cm360_create_floodlight_activity: 'standard',
  cm360_create_floodlight_activity_group: 'standard',
  cm360_create_report: 'standard',
  cm360_run_report: 'standard',

  // Update operations — standard risk (elevated if archiving/deactivating)
  cm360_update_campaign: 'standard',
  cm360_update_placement: 'standard',
  cm360_update_ad: 'standard',
  cm360_update_creative: 'standard',
  cm360_update_landing_page: 'standard',
  cm360_update_event_tag: 'standard',
  cm360_update_placement_group: 'standard',

  // Access-control operations — elevated risk (change who can do what in the account)
  cm360_create_account_user_profile: 'elevated',
  cm360_create_user_role: 'elevated',

  // No delete tools: CM360 has no delete for core trafficking entities, and the
  // product deliberately ships zero delete operations. Irreversible archives
  // (PERMANENTLY_ARCHIVED) are escalated to 'destructive' in classifyTool below.
};

/** Check if a tool is a write operation requiring confirmation */
export function isWriteTool(toolName: string): boolean {
  return toolName in WRITE_TOOL_RISK_MAP;
}

/** Classify a tool's risk level, accounting for input payload.
 *
 * Returns null for read-only tools (not in the write map).
 * For write tools, returns the base risk level from the map,
 * but escalates to 'elevated' or 'destructive' when the input
 * contains archive/deactivate fields.
 */
export function classifyTool(
  toolName: string,
  input?: Record<string, unknown>,
): OperationRiskLevel | null {
  const baseLevel = WRITE_TOOL_RISK_MAP[toolName];
  if (!baseLevel) return null;

  // Elevate risk for archive/deactivate operations
  if (input && baseLevel === 'standard') {
    if (input.archived === true) return 'elevated';
    if (input.activeStatus === 'PERMANENTLY_ARCHIVED') return 'destructive';
    if (input.activeStatus === 'INACTIVE' || input.activeStatus === 'ARCHIVED') return 'elevated';
  }

  return baseLevel;
}
