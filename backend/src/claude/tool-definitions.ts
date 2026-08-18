import type Anthropic from '@anthropic-ai/sdk';
import { CM360_TOOLS as SHARED_CM360_TOOLS } from '@adtraffic/shared/mock-cm360';
import type { BooleanFlagName, ResolvedFlags } from '../feature-flags/flag-registry.js';

/**
 * CM360 tool definitions for Claude's tool use.
 *
 * The tool array itself lives in @adtraffic/shared/mock-cm360 (dependency-free,
 * reusable by the MCP demo server). This module re-exports it typed as
 * Anthropic.Tool[] and keeps the backend-specific feature-flag gating.
 */
export const CM360_TOOLS: Anthropic.Tool[] = SHARED_CM360_TOOLS;


/**
 * Maps each tool name to the boolean feature flag that gates it.
 * If the flag is false, the tool is excluded from the Claude API call.
 */
export const TOOL_FLAG_MAP: Record<string, BooleanFlagName> = {
  // Read tools
  cm360_list_profiles: 'cm360.read_operations',
  cm360_list_advertisers: 'cm360.read_operations',
  cm360_get_advertiser: 'cm360.read_operations',
  cm360_list_campaigns: 'cm360.read_operations',
  cm360_list_sites: 'cm360.read_operations',
  cm360_list_landing_pages: 'cm360.read_operations',
  cm360_list_placements: 'cm360.read_operations',
  cm360_list_creatives: 'cm360.read_operations',
  cm360_list_ads: 'cm360.read_operations',
  cm360_get_campaign: 'cm360.read_operations',
  cm360_get_placement: 'cm360.read_operations',
  cm360_get_ad: 'cm360.read_operations',
  cm360_get_creative: 'cm360.read_operations',
  cm360_get_landing_page: 'cm360.read_operations',
  cm360_get_site: 'cm360.read_operations',
  cm360_list_sizes: 'cm360.read_operations',
  cm360_list_campaign_creative_associations: 'cm360.read_operations',
  // Write tools
  cm360_create_campaign: 'cm360.write_operations',
  cm360_create_placement: 'cm360.write_operations',
  cm360_create_ad: 'cm360.write_operations',
  cm360_create_landing_page: 'cm360.write_operations',
  cm360_create_creative: 'cm360.write_operations',
  cm360_update_campaign: 'cm360.write_operations',
  cm360_update_placement: 'cm360.write_operations',
  cm360_update_ad: 'cm360.write_operations',
  cm360_update_creative: 'cm360.write_operations',
  cm360_update_landing_page: 'cm360.write_operations',
  cm360_associate_creative_campaign: 'cm360.write_operations',
  cm360_upload_creative_asset: 'cm360.write_operations',
  // Event tags (read)
  cm360_list_event_tags: 'cm360.read_operations',
  cm360_get_event_tag: 'cm360.read_operations',
  // Event tags (write)
  cm360_create_event_tag: 'cm360.write_operations',
  cm360_update_event_tag: 'cm360.write_operations',
  // Placement groups (read)
  cm360_list_placement_groups: 'cm360.read_operations',
  cm360_get_placement_group: 'cm360.read_operations',
  // Placement groups (write)
  cm360_create_placement_group: 'cm360.write_operations',
  cm360_update_placement_group: 'cm360.write_operations',
  // Directory sites (read)
  cm360_list_directory_sites: 'cm360.read_operations',
  cm360_get_directory_site: 'cm360.read_operations',
  // Directory sites (write — insert approves a site)
  cm360_insert_directory_site: 'cm360.write_operations',
  // Change logs (read-only audit trail)
  cm360_list_change_logs: 'cm360.read_operations',
  cm360_get_change_log: 'cm360.read_operations',
  // Reports (read-only report definitions and execution)
  cm360_list_reports: 'cm360.read_operations',
  cm360_get_report: 'cm360.read_operations',
  cm360_create_report: 'cm360.write_operations',
  cm360_run_report: 'cm360.read_operations',
  cm360_get_report_file: 'cm360.read_operations',
  cm360_query_compatible_fields: 'cm360.read_operations',
  // Floodlight (read)
  cm360_list_floodlight_activities: 'cm360.read_operations',
  cm360_get_floodlight_activity: 'cm360.read_operations',
  cm360_list_floodlight_activity_groups: 'cm360.read_operations',
  cm360_get_floodlight_activity_group: 'cm360.read_operations',
  cm360_list_floodlight_configurations: 'cm360.read_operations',
  cm360_generate_floodlight_tag: 'cm360.read_operations',
  // Floodlight (write)
  cm360_create_floodlight_activity: 'cm360.write_operations',
  cm360_create_floodlight_activity_group: 'cm360.write_operations',
  // User & Role Management (read)
  cm360_list_account_user_profiles: 'cm360.user_management',
  cm360_get_account_user_profile: 'cm360.user_management',
  cm360_list_user_roles: 'cm360.user_management',
  cm360_get_user_role: 'cm360.user_management',
  cm360_list_user_role_permissions: 'cm360.user_management',
  cm360_get_user_role_permission: 'cm360.user_management',
  cm360_list_user_role_permission_groups: 'cm360.user_management',
  cm360_get_user_role_permission_group: 'cm360.user_management',
  cm360_list_subaccounts: 'cm360.user_management',
  cm360_get_subaccount: 'cm360.user_management',
  // User & Role Management (write)
  cm360_create_account_user_profile: 'cm360.user_management',
  cm360_create_user_role: 'cm360.user_management',
  // Tag generation
  cm360_generate_tags: 'cm360.tag_generation',
  // Pacing analysis (read-only computed data)
  cm360_pacing_analysis: 'cm360.read_operations',
};

/**
 * Tools presented ONLY in demo mode and withheld from Claude on a live CM360
 * connection (see kiki-service). Intentionally empty — all 70 tools are
 * live-implemented, so nothing is withheld in live mode. NOTE: the live path is
 * unverified against a real CM360 API; live mode is offered but not proven.
 */
export const STUBBED_TOOLS = new Set<string>([]);

/**
 * Filter CM360_TOOLS based on the user's resolved feature flags.
 * Returns only the tools whose gating flag is enabled.
 */
export function getEnabledTools(flags: ResolvedFlags): Anthropic.Tool[] {
  return CM360_TOOLS.filter((tool) => {
    const flagName = TOOL_FLAG_MAP[tool.name];
    if (!flagName) return true; // No flag mapping = always enabled
    return flags[flagName];
  });
}
