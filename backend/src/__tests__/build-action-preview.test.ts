import { describe, it, expect } from 'vitest';
import { buildActionPreview } from '../claude/kiki-service.js';

describe('buildActionPreview', () => {
  describe('create operations', () => {
    it('creates preview for campaign creation', () => {
      const preview = buildActionPreview('cm360_create_campaign', {
        advertiserId: '1001',
        name: 'Q1 Display',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
      });

      expect(preview.entityType).toBe('Campaign');
      expect(preview.operation).toBe('create');
      expect(preview.entityName).toBe('Q1 Display');
      expect(preview.fields).toBeDefined();
      expect(preview.fields!.length).toBeGreaterThan(0);
      expect(preview.fields!.some(f => f.field === 'name' && f.value === 'Q1 Display')).toBe(true);
    });

    it('creates preview for placement creation', () => {
      const preview = buildActionPreview('cm360_create_placement', {
        campaignId: '2001',
        siteId: '3001',
        name: 'Homepage Leaderboard',
        width: 728,
        height: 90,
        startDate: '2026-04-01',
        endDate: '2026-06-30',
      });

      expect(preview.entityType).toBe('Placement');
      expect(preview.operation).toBe('create');
      expect(preview.entityName).toBe('Homepage Leaderboard');
      expect(preview.fields).toBeDefined();
      expect(preview.fields!.some(f => f.field === 'width' && f.value === '728')).toBe(true);
    });

    it('creates preview for landing page creation', () => {
      const preview = buildActionPreview('cm360_create_landing_page', {
        advertiserId: '1001',
        name: 'Product Page',
        url: 'https://example.com/product',
      });

      expect(preview.entityType).toBe('Landing Page');
      expect(preview.operation).toBe('create');
      expect(preview.entityName).toBe('Product Page');
    });

    it('creates preview for creative creation', () => {
      const preview = buildActionPreview('cm360_create_creative', {
        advertiserId: '1001',
        name: 'Summer Banner',
        type: 'DISPLAY',
        width: 300,
        height: 250,
      });

      expect(preview.entityType).toBe('Creative');
      expect(preview.operation).toBe('create');
      expect(preview.entityName).toBe('Summer Banner');
    });

    it('creates preview for creative-campaign association', () => {
      const preview = buildActionPreview('cm360_associate_creative_campaign', {
        campaignId: '1001',
        creativeId: '3001',
      });

      expect(preview.entityType).toBe('Creative-Campaign Association');
      expect(preview.operation).toBe('create');
    });

    it('creates preview for creative asset upload', () => {
      const preview = buildActionPreview('cm360_upload_creative_asset', {
        advertiserId: '1001',
        assetName: 'hero-banner.png',
        assetType: 'IMAGE',
        assetData: 'base64data',
      });

      expect(preview.entityType).toBe('Creative Asset');
      expect(preview.operation).toBe('create');
    });
  });

  describe('update operations', () => {
    it('creates preview for placement update', () => {
      const preview = buildActionPreview('cm360_update_placement', {
        id: '2001',
        profileId: '123',
        name: 'Updated Placement',
      });

      expect(preview.entityType).toBe('Placement');
      expect(preview.operation).toBe('update');
      expect(preview.changes).toBeDefined();
      expect(preview.changes!.some(c => c.field === 'name')).toBe(true);
      // Should NOT include 'id' or 'profileId' in changes
      expect(preview.changes!.some(c => c.field === 'id')).toBe(false);
      expect(preview.changes!.some(c => c.field === 'profileId')).toBe(false);
    });

    it('creates preview for campaign update', () => {
      const preview = buildActionPreview('cm360_update_campaign', {
        campaignId: '1001',
        name: 'Renamed Campaign',
        endDate: '2026-12-31',
      });

      expect(preview.entityType).toBe('Campaign');
      expect(preview.operation).toBe('update');
      expect(preview.changes).toBeDefined();
      expect(preview.changes!.some(c => c.field === 'name' && c.to === 'Renamed Campaign')).toBe(true);
      expect(preview.changes!.some(c => c.field === 'endDate' && c.to === '2026-12-31')).toBe(true);
    });

    it('creates preview for ad update', () => {
      const preview = buildActionPreview('cm360_update_ad', {
        adId: '4001',
        name: 'Updated Ad',
      });

      expect(preview.entityType).toBe('Ad');
      expect(preview.operation).toBe('update');
      expect(preview.changes).toBeDefined();
      expect(preview.changes!.some(c => c.field === 'name')).toBe(true);
    });

    it('creates preview for creative update', () => {
      const preview = buildActionPreview('cm360_update_creative', {
        creativeId: '3001',
        name: 'New Creative Name',
      });

      expect(preview.entityType).toBe('Creative');
      expect(preview.operation).toBe('update');
    });

    it('creates preview for landing page update', () => {
      const preview = buildActionPreview('cm360_update_landing_page', {
        landingPageId: '5001',
        name: 'Updated LP',
        url: 'https://new.example.com',
      });

      expect(preview.entityType).toBe('Landing Page');
      expect(preview.operation).toBe('update');
    });
  });

  describe('archive operations', () => {
    it('detects archive from archived:true', () => {
      const preview = buildActionPreview('cm360_update_campaign', {
        campaignId: '1001',
        archived: true,
      });

      expect(preview.operation).toBe('archive');
      expect(preview.warnings).toBeDefined();
      expect(preview.warnings!.length).toBeGreaterThan(0);
      expect(preview.warnings!.some(w => w.includes('Archiving'))).toBe(true);
    });

    it('detects archive from activeStatus INACTIVE', () => {
      const preview = buildActionPreview('cm360_update_placement', {
        placementId: '2001',
        activeStatus: 'INACTIVE',
      });

      expect(preview.operation).toBe('archive');
    });

    it('detects archive from activeStatus ARCHIVED', () => {
      const preview = buildActionPreview('cm360_update_placement', {
        placementId: '2001',
        activeStatus: 'ARCHIVED',
      });

      expect(preview.operation).toBe('archive');
    });
  });

  describe('destructive operations', () => {
    it('detects PERMANENTLY_ARCHIVED with cannot-undo warning', () => {
      const preview = buildActionPreview('cm360_update_placement', {
        placementId: '2001',
        activeStatus: 'PERMANENTLY_ARCHIVED',
      });

      expect(preview.operation).toBe('archive');
      expect(preview.warnings).toBeDefined();
      expect(preview.warnings!.some(w => w.includes('CANNOT be undone'))).toBe(true);
    });

    it('handles delete tool', () => {
      const preview = buildActionPreview('cm360_delete_event_tag', {
        id: '5001',
        profileId: '123',
      });

      expect(preview.entityType).toBe('Event Tag');
      expect(preview.operation).toBe('delete');
    });

    it('handles delete floodlight activity', () => {
      const preview = buildActionPreview('cm360_delete_floodlight_activity', {
        id: '6001',
        profileId: '123',
      });

      expect(preview.entityType).toBe('Floodlight Activity');
      expect(preview.operation).toBe('delete');
    });
  });

  describe('edge cases', () => {
    it('handles unknown tool name gracefully', () => {
      const preview = buildActionPreview('cm360_unknown_tool', {
        name: 'Something',
      });

      expect(preview.entityType).toBe('Entity');
      expect(preview.entityName).toBe('Something');
    });

    it('falls back to ID fields for entityName when name is missing', () => {
      const preview = buildActionPreview('cm360_associate_creative_campaign', {
        campaignId: '1001',
        creativeId: '3001',
      });

      expect(preview.entityName).toBe('1001');
    });

    it('uses "Unknown" when no name or ID fields are present', () => {
      const preview = buildActionPreview('cm360_update_campaign', {
        archived: true,
      });

      expect(preview.entityName).toBe('Unknown');
    });

    it('excludes object-type values from create fields', () => {
      const preview = buildActionPreview('cm360_create_campaign', {
        name: 'Test',
        advertiserId: '1001',
        metadata: { nested: true },
      });

      expect(preview.fields).toBeDefined();
      expect(preview.fields!.some(f => f.field === 'metadata')).toBe(false);
      expect(preview.fields!.some(f => f.field === 'name')).toBe(true);
    });

    it('excludes null and undefined from fields', () => {
      const preview = buildActionPreview('cm360_create_campaign', {
        name: 'Test',
        description: null,
        notes: undefined,
      });

      expect(preview.fields).toBeDefined();
      expect(preview.fields!.some(f => f.field === 'description')).toBe(false);
      expect(preview.fields!.some(f => f.field === 'notes')).toBe(false);
    });
  });
});
