/**
 * Tests for CM360 tool definitions — validates schema structure, required fields,
 * naming conventions, and write operation safety labels.
 */

import { describe, it, expect } from 'vitest';
import { CM360_TOOLS } from '../claude/tool-definitions.js';

// All 14 expected tools
const EXPECTED_TOOLS = [
  'cm360_list_profiles',
  'cm360_list_advertisers',
  'cm360_get_advertiser',
  'cm360_list_campaigns',
  'cm360_create_campaign',
  'cm360_list_sites',
  'cm360_list_landing_pages',
  'cm360_create_landing_page',
  'cm360_list_placements',
  'cm360_create_placement',
  'cm360_list_creatives',
  'cm360_list_ads',
  'cm360_create_ad',
  'cm360_generate_tags',
];

const WRITE_TOOLS = [
  'cm360_create_campaign',
  'cm360_create_placement',
  'cm360_create_ad',
  'cm360_create_landing_page',
];

describe('Tool inventory', () => {
  it('defines exactly 14 tools', () => {
    expect(CM360_TOOLS).toHaveLength(14);
  });

  it('includes all expected tool names', () => {
    const names = CM360_TOOLS.map((t) => t.name);
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });

  it('has no duplicate tool names', () => {
    const names = CM360_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('Tool schema structure', () => {
  it.each(CM360_TOOLS.map((t) => [t.name, t]))('%s has valid schema structure', (_name, tool) => {
    expect(tool.name).toMatch(/^cm360_/);
    expect(tool.description).toBeTruthy();
    expect(tool.description!.length).toBeGreaterThan(10);
    expect(tool.input_schema).toBeDefined();
    expect(tool.input_schema.type).toBe('object');
    expect(tool.input_schema.properties).toBeDefined();
    expect(Array.isArray(tool.input_schema.required)).toBe(true);
  });
});

describe('Required fields', () => {
  it('cm360_list_profiles has no required fields', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_list_profiles')!;
    expect(tool.input_schema.required).toEqual([]);
  });

  it('tools needing profileId require it (except list_profiles)', () => {
    const needsProfile = CM360_TOOLS.filter((t) => t.name !== 'cm360_list_profiles');
    for (const tool of needsProfile) {
      const required = tool.input_schema.required as string[];
      expect(required).toContain('profileId');
    }
  });

  it('cm360_create_campaign requires all mandatory fields', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_create_campaign')!;
    const required = tool.input_schema.required as string[];
    expect(required).toContain('profileId');
    expect(required).toContain('advertiserId');
    expect(required).toContain('name');
    expect(required).toContain('startDate');
    expect(required).toContain('endDate');
    expect(required).toContain('defaultLandingPageId');
  });

  it('cm360_create_placement requires all mandatory fields', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_create_placement')!;
    const required = tool.input_schema.required as string[];
    expect(required).toContain('profileId');
    expect(required).toContain('campaignId');
    expect(required).toContain('siteId');
    expect(required).toContain('name');
    expect(required).toContain('width');
    expect(required).toContain('height');
    expect(required).toContain('startDate');
    expect(required).toContain('endDate');
  });

  it('cm360_create_ad requires all mandatory fields', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_create_ad')!;
    const required = tool.input_schema.required as string[];
    expect(required).toContain('profileId');
    expect(required).toContain('campaignId');
    expect(required).toContain('name');
    expect(required).toContain('placementIds');
    expect(required).toContain('creativeId');
  });

  it('cm360_generate_tags requires campaignId and placementIds', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_generate_tags')!;
    const required = tool.input_schema.required as string[];
    expect(required).toContain('profileId');
    expect(required).toContain('campaignId');
    expect(required).toContain('placementIds');
  });
});

describe('Write operation safety labels', () => {
  it.each(WRITE_TOOLS)('%s description includes confirmation warning', (toolName) => {
    const tool = CM360_TOOLS.find((t) => t.name === toolName)!;
    expect(tool.description).toMatch(/confirm/i);
    expect(tool.description).toMatch(/preview/i);
  });

  it('read-only tools do not have confirmation warnings', () => {
    const readTools = CM360_TOOLS.filter((t) => !WRITE_TOOLS.includes(t.name));
    for (const tool of readTools) {
      // generate_tags is read-only (just generates HTML, doesn't mutate)
      expect(tool.description).not.toMatch(/IMPORTANT.*confirm/i);
    }
  });
});

describe('Property types', () => {
  it('maxResults is always type number', () => {
    for (const tool of CM360_TOOLS) {
      const props = tool.input_schema.properties as Record<string, { type?: string }>;
      if (props.maxResults) {
        expect(props.maxResults.type).toBe('number');
      }
    }
  });

  it('date fields are type string', () => {
    for (const tool of CM360_TOOLS) {
      const props = tool.input_schema.properties as Record<string, { type?: string }>;
      if (props.startDate) expect(props.startDate.type).toBe('string');
      if (props.endDate) expect(props.endDate.type).toBe('string');
    }
  });

  it('array fields (placementIds, tagFormats) are type array', () => {
    const createAd = CM360_TOOLS.find((t) => t.name === 'cm360_create_ad')!;
    const props = createAd.input_schema.properties as Record<string, { type?: string }>;
    expect(props.placementIds!.type).toBe('array');

    const genTags = CM360_TOOLS.find((t) => t.name === 'cm360_generate_tags')!;
    const tagProps = genTags.input_schema.properties as Record<string, { type?: string }>;
    expect(tagProps.placementIds!.type).toBe('array');
    expect(tagProps.tagFormats!.type).toBe('array');
  });

  it('placement compatibility has valid enum values', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_create_placement')!;
    const props = tool.input_schema.properties as Record<string, { enum?: string[] }>;
    expect(props.compatibility!.enum).toEqual(['DISPLAY', 'IN_STREAM_VIDEO', 'IN_STREAM_AUDIO']);
  });

  it('payment source has valid enum values', () => {
    const tool = CM360_TOOLS.find((t) => t.name === 'cm360_create_placement')!;
    const props = tool.input_schema.properties as Record<string, { enum?: string[] }>;
    expect(props.paymentSource!.enum).toEqual(['PLACEMENT_AGENCY_PAID', 'PLACEMENT_PUBLISHER_PAID']);
  });
});
