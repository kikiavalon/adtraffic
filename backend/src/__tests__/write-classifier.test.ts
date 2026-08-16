import { describe, it, expect } from 'vitest';
import { classifyTool, isWriteTool, WRITE_TOOL_RISK_MAP } from '../cm360/write-classifier.js';
import { TOOL_FLAG_MAP } from '../claude/tool-definitions.js';

describe('write-classifier', () => {
  describe('isWriteTool', () => {
    it('returns true for create tools', () => {
      expect(isWriteTool('cm360_create_campaign')).toBe(true);
      expect(isWriteTool('cm360_create_placement')).toBe(true);
    });

    it('returns true for update tools', () => {
      expect(isWriteTool('cm360_update_campaign')).toBe(true);
      expect(isWriteTool('cm360_update_ad')).toBe(true);
    });

    it('returns false for read tools', () => {
      expect(isWriteTool('cm360_list_campaigns')).toBe(false);
      expect(isWriteTool('cm360_get_placement')).toBe(false);
    });

    it('returns false for tag generation', () => {
      expect(isWriteTool('cm360_generate_tags')).toBe(false);
    });

    it('returns true for every tool flagged as a write operation in TOOL_FLAG_MAP', () => {
      const writeFlaggedTools = Object.entries(TOOL_FLAG_MAP)
        .filter(([, flag]) => flag === 'cm360.write_operations')
        .map(([toolName]) => toolName);

      expect(writeFlaggedTools.length).toBeGreaterThan(0);
      for (const toolName of writeFlaggedTools) {
        expect(isWriteTool(toolName), `${toolName} is flagged cm360.write_operations but missing from WRITE_TOOL_RISK_MAP`).toBe(true);
      }
    });

    it('returns true for mutating user-management tools', () => {
      expect(isWriteTool('cm360_create_account_user_profile')).toBe(true);
      expect(isWriteTool('cm360_create_user_role')).toBe(true);
    });

    it('returns true for report execution (creates report files)', () => {
      expect(isWriteTool('cm360_run_report')).toBe(true);
    });
  });

  describe('classifyTool', () => {
    it('classifies create operations as standard', () => {
      expect(classifyTool('cm360_create_campaign')).toBe('standard');
      expect(classifyTool('cm360_create_placement')).toBe('standard');
    });

    it('classifies update operations as standard', () => {
      expect(classifyTool('cm360_update_campaign')).toBe('standard');
    });

    it('classifies archive/deactivate as elevated', () => {
      expect(classifyTool('cm360_update_campaign', { archived: true })).toBe('elevated');
      expect(classifyTool('cm360_update_placement', { activeStatus: 'INACTIVE' })).toBe('elevated');
    });

    it('classifies ARCHIVED activeStatus as elevated', () => {
      expect(classifyTool('cm360_update_placement', { activeStatus: 'ARCHIVED' })).toBe('elevated');
    });

    it('classifies PERMANENTLY_ARCHIVED as destructive', () => {
      expect(classifyTool('cm360_update_placement', { activeStatus: 'PERMANENTLY_ARCHIVED' })).toBe('destructive');
    });

    it('has no delete tools — CM360 core entities cannot be deleted, and the product ships zero delete operations', () => {
      expect(classifyTool('cm360_delete_event_tag')).toBeNull();
      expect(classifyTool('cm360_delete_floodlight_activity')).toBeNull();
    });

    it('classifies ad creation as standard', () => {
      expect(classifyTool('cm360_create_ad')).toBe('standard');
    });

    it('classifies event tag create/update as standard', () => {
      expect(classifyTool('cm360_create_event_tag')).toBe('standard');
      expect(classifyTool('cm360_update_event_tag')).toBe('standard');
    });

    it('classifies placement group create/update as standard', () => {
      expect(classifyTool('cm360_create_placement_group')).toBe('standard');
      expect(classifyTool('cm360_update_placement_group')).toBe('standard');
    });

    it('classifies directory site insert as standard', () => {
      expect(classifyTool('cm360_insert_directory_site')).toBe('standard');
    });

    it('classifies floodlight creates as standard', () => {
      expect(classifyTool('cm360_create_floodlight_activity')).toBe('standard');
      expect(classifyTool('cm360_create_floodlight_activity_group')).toBe('standard');
    });

    it('classifies report create/run as standard', () => {
      expect(classifyTool('cm360_create_report')).toBe('standard');
      expect(classifyTool('cm360_run_report')).toBe('standard');
    });

    it('classifies user-management creates as elevated (access-control changes)', () => {
      expect(classifyTool('cm360_create_account_user_profile')).toBe('elevated');
      expect(classifyTool('cm360_create_user_role')).toBe('elevated');
    });

    it('returns null for read tools', () => {
      expect(classifyTool('cm360_list_campaigns')).toBeNull();
    });

    it('returns null for unknown tools', () => {
      expect(classifyTool('unknown_tool')).toBeNull();
    });
  });

  it('covers all write tools in risk map', () => {
    expect(Object.keys(WRITE_TOOL_RISK_MAP).length).toBeGreaterThanOrEqual(23);
  });

  it('every entry in risk map has a valid risk level', () => {
    const validLevels = ['standard', 'elevated', 'destructive'];
    for (const [toolName, level] of Object.entries(WRITE_TOOL_RISK_MAP)) {
      expect(validLevels).toContain(level);
      expect(toolName).toMatch(/^cm360_/);
    }
  });
});
