import { describe, it, expect } from 'vitest';
import { classifyTool, isWriteTool, WRITE_TOOL_RISK_MAP } from '../cm360/write-classifier.js';

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

    it('classifies delete operations as destructive', () => {
      expect(classifyTool('cm360_delete_event_tag')).toBe('destructive');
    });

    it('returns null for read tools', () => {
      expect(classifyTool('cm360_list_campaigns')).toBeNull();
    });

    it('returns null for unknown tools', () => {
      expect(classifyTool('unknown_tool')).toBeNull();
    });
  });

  it('covers all write tools in risk map', () => {
    expect(Object.keys(WRITE_TOOL_RISK_MAP).length).toBeGreaterThanOrEqual(10);
  });

  it('every entry in risk map has a valid risk level', () => {
    const validLevels = ['standard', 'elevated', 'destructive'];
    for (const [toolName, level] of Object.entries(WRITE_TOOL_RISK_MAP)) {
      expect(validLevels).toContain(level);
      expect(toolName).toMatch(/^cm360_/);
    }
  });
});
