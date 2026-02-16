/**
 * Naming convention enforcement test prompts.
 *
 * These test that Kiki detects existing naming patterns in the account
 * and warns when new entities would break established conventions.
 *
 * Naming patterns in mock data:
 *   Campaigns:   {AdvFirstWord} Q# 2026 {Channel} {Objective}
 *   Placements:  {Site}_{Adv}_{WxH}_{MMYY}_{Type}
 *   Creatives:   {Adv}_{WxH}_v{N}
 *   Ads:         {Adv}_Ad_{WxH}_{N}
 *   Landing pages (advertisers 0-2 only):
 *     URL includes ?utm_source=cm360&utm_medium=display&utm_campaign={adv-slug}{-suffix}
 *   Landing pages (advertisers 3-6): no UTM params
 */

import type { TestPrompt } from './test-prompts.js';

// ---------------------------------------------------------------------------
// A. Campaign Naming Violations (NC-001 to NC-006)
// ---------------------------------------------------------------------------

const campaignNaming: TestPrompt[] = [
  {
    id: 'NC-001',
    prompt: "Create a campaign for Apex Motors called 'Bob\\'s Campaign' running Q2 2026",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Fetches existing Apex campaigns, detects {Adv} Q# Year Channel Objective pattern, warns that "Bob\'s Campaign" violates it, suggests correct format',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc001_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc001_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc001_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I noticed that existing Apex Motors campaigns follow a consistent naming convention:\n\n- Apex Q1 2026 Display Awareness\n- Apex Q2 2026 Video Conversions\n- Apex Q3 2026 Mobile Retargeting\n\nThe pattern is: **Apex Q# 2026 [Channel] [Objective]**\n\nThe name "Bob\'s Campaign" doesn\'t follow this pattern. To stay consistent, I\'d suggest something like:\n\n- **Apex Q2 2026 [Channel] [Objective]**\n\nWhat channel (Display, Video, Mobile, Cross-Platform) and objective (Awareness, Conversions, Retargeting, etc.) should this campaign target?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Apex Q', description: 'Shows the existing pattern' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create with the bad name' },
    ],
  },
  {
    id: 'NC-002',
    prompt: "Create a campaign for Luminance called 'Spring Sale'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Fetches existing Luminance campaigns, detects naming pattern, warns that "Spring Sale" violates it',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc002_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc002_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc002_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I see that Luminance Beauty campaigns follow a consistent pattern:\n\n- Luminance Q1 2026 [Channel] [Objective]\n- Luminance Q2 2026 [Channel] [Objective]\n\nThe name "Spring Sale" doesn\'t match this pattern. To keep things consistent, I\'d suggest a name like:\n\n- **Luminance Q2 2026 Display Conversions** (or whichever channel/objective fits)\n\nWhat quarter, channel, and objective is this campaign for?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'pattern', description: 'Identifies the naming pattern' },
      { type: 'contains', value: 'Luminance Q', description: 'Shows correct format' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create with the bad name' },
    ],
  },
  {
    id: 'NC-003',
    prompt: "New campaign for Meridian Financial: 'Test Campaign 123'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Detects naming pattern for Meridian, warns about "Test Campaign 123"',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc003_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc003_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc003_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Heads up \u2014 existing Meridian Financial campaigns follow a naming convention:\n\n- Meridian Q1 2026 [Channel] [Objective]\n- Meridian Q2 2026 [Channel] [Objective]\n\nThe name "Test Campaign 123" breaks this pattern. I\'d recommend naming it like:\n\n- **Meridian Q# 2026 [Channel] [Objective]**\n\nWhat quarter, channel, and objective are you targeting?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Meridian Q', description: 'Shows correct format' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create with the bad name' },
    ],
  },
  {
    id: 'NC-004',
    prompt: "Create a Q2 campaign for Vanguard called 'Vanguard Summer Promos'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Close but wrong format \u2014 missing channel and objective as separate words. Warns and suggests "Vanguard Q2 2026 [Channel] [Objective]"',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc004_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc004_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Vanguard' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc004_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90004' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Almost there! Existing Vanguard Athletics campaigns follow this pattern:\n\n- **Vanguard Q# 2026 [Channel] [Objective]**\n\nYour proposed name "Vanguard Summer Promos" is close but doesn\'t include the year, channel, or objective in the expected format. A consistent name would be:\n\n- **Vanguard Q2 2026 [Channel] [Objective]**\n\nFor example: "Vanguard Q2 2026 Display Conversions"\n\nWhat channel and objective should this campaign have?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'pattern', description: 'Identifies the naming pattern' },
      { type: 'contains', value: 'Vanguard Q2 2026', description: 'Suggests correct format' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create with the wrong name' },
    ],
  },
  {
    id: 'NC-005',
    prompt: "Create a campaign for NovaTech called 'NovaTech Q2 2026 Display Awareness' starting April 1 through June 30",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_landing_pages'],
    expectedBehavior: 'Correct name matching the pattern. No naming warning. Shows preview and asks for confirmation.',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc005_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc005_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'NovaTech' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc005_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90003' } },
          { type: 'tool_use', id: 'nc005_4', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90003' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s the campaign I\'d create:\n\n**Campaign Preview:**\n- **Advertiser:** NovaTech Solutions (90003)\n- **Name:** NovaTech Q2 2026 Display Awareness\n- **Start Date:** 2026-04-01\n- **End Date:** 2026-06-30\n- **Landing Page:** NovaTech Solutions Homepage\n\nShall I go ahead and create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'naming convention', description: 'No naming convention warning for correct name' },
      { type: 'not_contains', value: 'pattern', description: 'No pattern warning needed' },
      { type: 'contains', value: 'NovaTech Q2 2026 Display Awareness', description: 'Uses the correct name as-is' },
      { type: 'contains', value: 'Shall I', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'NC-006',
    prompt: "Create a campaign for Harvest called 'harvest q3 video'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Violation: lowercase, missing year and objective. Suggests proper format like "Harvest Q3 2026 Video [Objective]"',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc006_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc006_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Harvest' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc006_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90006' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I noticed Harvest Organics campaigns follow a specific naming convention:\n\n- **Harvest Q# 2026 [Channel] [Objective]**\n\nThe name "harvest q3 video" has the right elements but doesn\'t match the format \u2014 it\'s missing the year, the objective, and uses lowercase. The correct format would be:\n\n- **Harvest Q3 2026 Video [Objective]**\n\nFor example: "Harvest Q3 2026 Video Awareness" or "Harvest Q3 2026 Video Conversions"\n\nWhat objective should this campaign have?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Harvest Q3 2026 Video', description: 'Suggests corrected format' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create with the bad name' },
    ],
  },
];

// ---------------------------------------------------------------------------
// B. Placement Naming Violations (NC-007 to NC-014)
// ---------------------------------------------------------------------------

const placementNaming: TestPrompt[] = [
  {
    id: 'NC-007',
    prompt: "Create a placement called 'My New Placement' for Apex on ESPN, 300x250, for the Q1 campaign",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Fetches existing placements, detects Site_Adv_WxH_MMYY_Type pattern, warns and suggests "ESPN_Apex_300x250_0126_Standard"',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc007_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc007_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc007_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'nc007_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I see that existing Apex Motors placements follow a naming convention:\n\n- ESPN_Apex_300x250_0126_Standard\n- CNN_Apex_728x90_0426_Roadblock\n- Forbes_Apex_970x250_0126_Standard\n\nThe pattern is: **{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nThe name "My New Placement" doesn\'t match this convention. Based on the details you provided, the correct name would be:\n\n- **ESPN_Apex_300x250_0126_Standard**\n\nWould you like to use this name instead?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'ESPN_Apex_300x250_0126_Standard', description: 'Suggests correct placement name' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create with the bad name' },
    ],
  },
  {
    id: 'NC-008',
    prompt: "Create a placement called 'ESPN 300x250' for the Apex Q1 campaign on ESPN",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Missing advertiser name, date, and type in the placement name. Warns about pattern.',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc008_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc008_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc008_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'nc008_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The name "ESPN 300x250" is missing several components from the established naming convention. Existing placements follow this pattern:\n\n**{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nYour name is missing the advertiser abbreviation, the date code, and the placement type. The correct name would be:\n\n- **ESPN_Apex_300x250_0126_Standard**\n\nWould you like me to use the conventional name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'ESPN_Apex_300x250', description: 'Suggests correct name' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without confirmation' },
    ],
  },
  {
    id: 'NC-009',
    prompt: "Name the placement 'test_placement_1' for Luminance on CNN, 728x90, Q2 campaign",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Warns that "test_placement_1" violates the established placement naming convention',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc009_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc009_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc009_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
          { type: 'tool_use', id: 'nc009_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The name "test_placement_1" doesn\'t match the naming convention used for existing Luminance Beauty placements:\n\n**{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nFor a CNN placement with 728x90 in the Q2 campaign, the correct name would be:\n\n- **CNN_Luminance_728x90_0426_Standard**\n\nWould you like to use the conventional name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'CNN_Luminance_728x90', description: 'Suggests correct name' },
    ],
  },
  {
    id: 'NC-010',
    prompt: "Create a placement on CNN for Meridian Q2 campaign, 300x250, name it 'CNN_Meridian_300x250_0426_Standard'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_sites'],
    expectedBehavior: 'Correct name matching the pattern. No naming warning. Shows preview and asks for confirmation.',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc010_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc010_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
          { type: 'tool_use', id: 'nc010_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'CNN' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc010_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90002' } },
          { type: 'tool_use', id: 'nc010_5', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s the placement I\'d create:\n\n**Placement Preview:**\n- **Campaign:** Meridian Q2 2026 Video Conversions\n- **Site:** CNN.com\n- **Name:** CNN_Meridian_300x250_0426_Standard\n- **Size:** 300x250\n- **Dates:** 2026-04-01 to 2026-06-30\n\nShall I create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'naming convention', description: 'No naming convention warning for correct name' },
      { type: 'contains', value: 'CNN_Meridian_300x250_0426_Standard', description: 'Uses the provided correct name' },
      { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'NC-011',
    prompt: "Create a placement on Forbes for NovaTech Q1, 970x250, call it 'Forbes Big Banner'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Warns that "Forbes Big Banner" violates the placement naming convention',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc011_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc011_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'NovaTech' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc011_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90003' } },
          { type: 'tool_use', id: 'nc011_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90003' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The name "Forbes Big Banner" doesn\'t follow the established naming convention for NovaTech placements:\n\n**{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nBased on your request, the correct name would be:\n\n- **Forbes_NovaTech_970x250_0126_Standard**\n\nWould you like to use this name instead?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Forbes_NovaTech_970x250', description: 'Suggests correct name' },
    ],
  },
  {
    id: 'NC-012',
    prompt: 'Add placement ESPN_Apex_300x250 to Q1 campaign',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Warns about incomplete name \u2014 missing MMYY and Type components',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc012_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc012_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc012_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'nc012_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The name "ESPN_Apex_300x250" is close but incomplete. Existing placements follow this full pattern:\n\n**{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nYour name is missing the date code (MMYY) and placement type. The complete name would be:\n\n- **ESPN_Apex_300x250_0126_Standard**\n\nWould you like to use the complete name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'pattern', description: 'References the pattern' },
      { type: 'contains', value: 'ESPN_Apex_300x250_0126_Standard', description: 'Suggests complete name' },
    ],
  },
  {
    id: 'NC-013',
    prompt: "Placement for Crestview on Hulu, 300x250, name it 'Hulu Ad'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Warns that "Hulu Ad" violates placement naming convention',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc013_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc013_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Crestview' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc013_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90005' } },
          { type: 'tool_use', id: 'nc013_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90005' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The name "Hulu Ad" doesn\'t follow the placement naming convention used across this account:\n\n**{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nFor this placement, the correct name would be something like:\n\n- **Hulu_Crestview_300x250_0126_Standard** (for Q1)\n\nWhich campaign should this placement go in? I\'ll use the correct date code from that campaign.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Hulu_Crestview_300x250', description: 'Suggests correct name' },
    ],
  },
  {
    id: 'NC-014',
    prompt: "Create a 320x50 mobile placement on Spotify for Harvest Organics Q3 \u2014 name it whatever you think is right",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_sites'],
    expectedBehavior: 'Kiki auto-suggests the correct name following the established convention',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc014_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc014_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Harvest' } },
          { type: 'tool_use', id: 'nc014_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'Spotify' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc014_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90006' } },
          { type: 'tool_use', id: 'nc014_5', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90006' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Based on the established placement naming convention, I\'d name this:\n\n**Placement Preview:**\n- **Campaign:** Harvest Q3 2026 Mobile Retargeting\n- **Site:** Spotify.com\n- **Name:** Spotify_Harvest_320x50_0726_Standard\n- **Size:** 320x50\n- **Dates:** 2026-07-01 to 2026-09-30\n\nThis follows the pattern: {Site}_{Adv}_{WxH}_{MMYY}_{Type}\n\nShall I create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'matches_pattern', value: 'Spotify_Harvest_320x50', description: 'Auto-suggests name following convention' },
      { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
    ],
  },
];

// ---------------------------------------------------------------------------
// C. Creative Naming Violations (NC-015 to NC-018)
// ---------------------------------------------------------------------------

const creativeNaming: TestPrompt[] = [
  {
    id: 'NC-015',
    prompt: "Name the creative 'cool banner' for Apex, 300x250",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_creatives'],
    expectedBehavior: 'Warns that "cool banner" violates the Adv_WxH_vN pattern. Suggests "Apex_300x250_v3" (next version).',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc015_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc015_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc015_3', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Apex Motors creatives follow a naming convention:\n\n- Apex_300x250_v1\n- Apex_728x90_v2\n\nThe pattern is: **{Adv}_{WxH}_v{N}**\n\nThe name "cool banner" doesn\'t match. Based on the next available version number, I\'d suggest:\n\n- **Apex_300x250_v3**\n\nWould you like to use this name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Apex_300x250_v3', description: 'Suggests next version number' },
    ],
  },
  {
    id: 'NC-016',
    prompt: "Creative for Luminance: 'Luminance_728x90_v3'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_creatives'],
    expectedBehavior: 'Correct name matching the pattern. No naming warning.',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc016_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc016_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc016_3', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I\'ll create the following creative:\n\n**Creative Preview:**\n- **Advertiser:** Luminance Beauty (90001)\n- **Name:** Luminance_728x90_v3\n- **Size:** 728x90\n- **Type:** Display Image Gallery\n\nThis follows the established pattern. Shall I create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'naming convention', description: 'No naming convention warning' },
      { type: 'contains', value: 'Luminance_728x90_v3', description: 'Uses provided correct name' },
      { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'NC-017',
    prompt: "Upload creative 'holiday_banner_final_v2' for Meridian 300x250",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_creatives'],
    expectedBehavior: 'Warns that "holiday_banner_final_v2" violates the Adv_WxH_vN pattern',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc017_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc017_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc017_3', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Meridian Financial creatives follow a naming convention:\n\n- Meridian_300x250_v1\n- Meridian_728x90_v2\n\nThe pattern is: **{Adv}_{WxH}_v{N}**\n\nThe name "holiday_banner_final_v2" doesn\'t match. For a new 300x250 creative, the next available name would be:\n\n- **Meridian_300x250_v3**\n\nWould you like to use the conventional name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Meridian_300x250', description: 'Suggests correct name' },
    ],
  },
  {
    id: 'NC-018',
    prompt: "New creative for Vanguard, 160x600, call it 'Vanguard Skyscraper'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_creatives'],
    expectedBehavior: 'Warns that "Vanguard Skyscraper" violates the Adv_WxH_vN pattern',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc018_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc018_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Vanguard' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc018_3', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90004' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Vanguard Athletics creatives follow the naming convention: **{Adv}_{WxH}_v{N}**\n\n- Vanguard_300x250_v1\n- Vanguard_728x90_v2\n\nThe name "Vanguard Skyscraper" doesn\'t match this pattern. The correct name for a 160x600 creative would be:\n\n- **Vanguard_160x600_v3**\n\nWould you like to use the conventional name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Vanguard_160x600', description: 'Suggests correct name' },
    ],
  },
];

// ---------------------------------------------------------------------------
// D. Ad Naming Violations (NC-019 to NC-022)
// ---------------------------------------------------------------------------

const adNaming: TestPrompt[] = [
  {
    id: 'NC-019',
    prompt: "Create an ad called 'my ad' for Apex Q1 campaign with the first creative and first placement",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_creatives', 'cm360_list_ads'],
    expectedBehavior: 'Fetches existing ads, detects Adv_Ad_WxH_N pattern, warns about "my ad"',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc019_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc019_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc019_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'nc019_4', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc019_5', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90024' } },
          { type: 'tool_use', id: 'nc019_6', name: 'cm360_list_ads', input: { profileId: '12345', campaignId: '90024' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Apex Motors ads follow a naming convention:\n\n- Apex_Ad_300x250_1\n- Apex_Ad_728x90_2\n\nThe pattern is: **{Adv}_Ad_{WxH}_{N}**\n\nThe name "my ad" doesn\'t match. Based on the first placement\'s size, the correct name would be:\n\n- **Apex_Ad_300x250_3**\n\nWould you like to use this name?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Apex_Ad_', description: 'Shows correct ad name pattern' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without confirmation' },
    ],
  },
  {
    id: 'NC-020',
    prompt: "Name the ad 'Apex_Ad_300x250_3' for the Apex Q1 campaign",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_ads'],
    expectedBehavior: 'Correct name matching the pattern. No naming warning.',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc020_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc020_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc020_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'nc020_4', name: 'cm360_list_ads', input: { profileId: '12345', campaignId: '90024' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The name follows the established convention. Here\'s the ad I\'d create:\n\n**Ad Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Name:** Apex_Ad_300x250_3\n\nI\'ll need to know which creative and placement to link. Would you like me to use the first available creative and placement from this campaign?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'naming convention', description: 'No naming convention warning' },
      { type: 'contains', value: 'Apex_Ad_300x250_3', description: 'Uses the correct name as-is' },
    ],
  },
  {
    id: 'NC-021',
    prompt: "New ad called 'ESPN Banner Ad' for Luminance Q1 campaign",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_ads'],
    expectedBehavior: 'Warns that "ESPN Banner Ad" violates the Adv_Ad_WxH_N pattern',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc021_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc021_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc021_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
          { type: 'tool_use', id: 'nc021_4', name: 'cm360_list_ads', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Luminance Beauty ads follow a naming convention:\n\n- Luminance_Ad_300x250_1\n- Luminance_Ad_728x90_2\n\nThe pattern is: **{Adv}_Ad_{WxH}_{N}**\n\nThe name "ESPN Banner Ad" doesn\'t match. I\'d recommend a name like:\n\n- **Luminance_Ad_{WxH}_{N}**\n\nWhat size creative and placement will this ad use? I\'ll calculate the next number in the sequence.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
      { type: 'contains', value: 'Luminance_Ad_', description: 'Shows correct ad name pattern' },
    ],
  },
  {
    id: 'NC-022',
    prompt: "Ad for Meridian: 'Finance Ad #1'",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_ads'],
    expectedBehavior: 'Warns that "Finance Ad #1" violates the Adv_Ad_WxH_N pattern',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc022_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc022_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc022_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90002' } },
          { type: 'tool_use', id: 'nc022_4', name: 'cm360_list_ads', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Meridian Financial ads follow the pattern: **{Adv}_Ad_{WxH}_{N}**\n\nExamples:\n- Meridian_Ad_300x250_1\n- Meridian_Ad_728x90_2\n\nThe name "Finance Ad #1" doesn\'t match this convention. I\'d recommend naming it:\n\n- **Meridian_Ad_{WxH}_{N}**\n\nWhich campaign and size should this ad use?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'pattern', description: 'References the naming pattern' },
      { type: 'contains', value: 'Meridian_Ad_', description: 'Shows correct ad name pattern' },
    ],
  },
];

// ---------------------------------------------------------------------------
// E. Landing Page UTM Violations (NC-023 to NC-030)
// ---------------------------------------------------------------------------

const landingPageUtm: TestPrompt[] = [
  {
    id: 'NC-023',
    prompt: "Create a landing page for Apex Motors called 'Spring Sale' with URL https://www.apexmotors.com/spring",
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Fetches existing Apex landing pages, detects UTM pattern, warns about missing UTMs on the provided URL',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc023_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc023_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc023_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I noticed that existing Apex Motors landing pages include UTM tracking parameters:\n\n- https://www.apexmotors.com?utm_source=cm360&utm_medium=display&utm_campaign=apex-motors-homepage\n- https://www.apexmotors.com/offers?utm_source=cm360&utm_medium=display&utm_campaign=apex-motors-offers\n\nThe URL you provided (https://www.apexmotors.com/spring) is missing the UTM parameters. To stay consistent, the URL should be:\n\n- **https://www.apexmotors.com/spring?utm_source=cm360&utm_medium=display&utm_campaign=apex-motors-spring**\n\nWould you like me to add the UTM parameters?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'UTM', description: 'Warns about missing UTM parameters' },
      { type: 'contains', value: 'utm_source=cm360', description: 'Shows the expected utm_source' },
      { type: 'contains', value: 'utm_medium=display', description: 'Shows the expected utm_medium' },
      { type: 'not_contains', value: 'cm360_create_landing_page', description: 'Does NOT create without confirmation' },
    ],
  },
  {
    id: 'NC-024',
    prompt: 'Create LP for Apex: URL https://www.apexmotors.com/spring?utm_source=cm360&utm_medium=display&utm_campaign=apex-motors-spring',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Correct UTMs matching the pattern. No UTM warning.',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc024_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc024_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc024_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s the landing page I\'d create:\n\n**Landing Page Preview:**\n- **Advertiser:** Apex Motors (90000)\n- **Name:** Spring Sale\n- **URL:** https://www.apexmotors.com/spring?utm_source=cm360&utm_medium=display&utm_campaign=apex-motors-spring\n\nThe UTM parameters are consistent with your existing landing pages. Shall I create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'missing UTM', description: 'No UTM warning for correct URL' },
      { type: 'contains', value: 'utm_source=cm360', description: 'Includes correct UTMs in preview' },
      { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'NC-025',
    prompt: 'New landing page for Luminance: https://www.luminancebeauty.com/new',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Warns about missing UTMs (Luminance has UTM pattern)',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc025_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc025_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc025_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I see that existing Luminance Beauty landing pages include UTM parameters:\n\n- utm_source=cm360\n- utm_medium=display\n- utm_campaign=luminance-beauty-{suffix}\n\nThe URL you provided (https://www.luminancebeauty.com/new) is missing these UTM parameters. The consistent URL would be:\n\n- **https://www.luminancebeauty.com/new?utm_source=cm360&utm_medium=display&utm_campaign=luminance-beauty-new**\n\nWould you like me to add the UTM parameters?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'UTM', description: 'Warns about missing UTM parameters' },
      { type: 'contains', value: 'utm_source=cm360', description: 'Shows expected utm_source' },
    ],
  },
  {
    id: 'NC-026',
    prompt: 'Landing page for Meridian: https://www.meridianfinancial.com/invest',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Warns about missing UTMs (Meridian has UTM pattern)',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc026_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc026_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc026_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Existing Meridian Financial landing pages include UTM tracking parameters, but the URL you provided is missing them.\n\nThe URL should include:\n- utm_source=cm360\n- utm_medium=display\n- utm_campaign=meridian-financial-invest\n\nCorrected URL:\n- **https://www.meridianfinancial.com/invest?utm_source=cm360&utm_medium=display&utm_campaign=meridian-financial-invest**\n\nWould you like me to use the corrected URL?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'UTM', description: 'Warns about missing UTM parameters' },
      { type: 'contains', value: 'utm_source=cm360', description: 'Shows expected UTMs' },
    ],
  },
  {
    id: 'NC-027',
    prompt: 'Landing page for Crestview: https://www.crestviewhotels.com/summer',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'No UTM warning \u2014 Crestview (advertiser index 5) has no UTM pattern in existing landing pages',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc027_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc027_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Crestview' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc027_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90005' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s the landing page I\'d create:\n\n**Landing Page Preview:**\n- **Advertiser:** Crestview Hotels (90005)\n- **Name:** Crestview Hotels Summer\n- **URL:** https://www.crestviewhotels.com/summer\n\nShall I go ahead and create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'UTM', description: 'No UTM warning for Crestview (no pattern)' },
      { type: 'contains', value: 'crestviewhotels.com/summer', description: 'Uses the provided URL as-is' },
      { type: 'contains', value: 'Shall I', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'NC-028',
    prompt: 'LP for Apex: https://www.apexmotors.com/fall?utm_source=facebook&utm_medium=social',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Warns about inconsistent UTM values \u2014 utm_source should be cm360, utm_medium should be display',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc028_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc028_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc028_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The URL has UTM parameters, but they don\'t match the pattern used in existing Apex Motors landing pages:\n\n**Your URL:** utm_source=facebook, utm_medium=social\n**Existing pattern:** utm_source=cm360, utm_medium=display\n\nSince this is a CM360-trafficked landing page, the consistent UTMs would be:\n\n- **https://www.apexmotors.com/fall?utm_source=cm360&utm_medium=display&utm_campaign=apex-motors-fall**\n\nWould you like me to use the CM360-consistent UTM values, or keep your original ones?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'utm_source', description: 'Warns about inconsistent utm_source' },
      { type: 'contains', value: 'utm_medium', description: 'Warns about inconsistent utm_medium' },
      { type: 'contains', value: 'cm360', description: 'Shows the expected utm_source value' },
    ],
  },
  {
    id: 'NC-029',
    prompt: 'Landing page for NovaTech: https://www.novatechsolutions.com/new',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'No UTM warning \u2014 NovaTech (advertiser index 3) has no UTM pattern in existing landing pages',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc029_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc029_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'NovaTech' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc029_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90003' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s the landing page I\'d create:\n\n**Landing Page Preview:**\n- **Advertiser:** NovaTech Solutions (90003)\n- **Name:** NovaTech Solutions New\n- **URL:** https://www.novatechsolutions.com/new\n\nShall I go ahead and create it?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'UTM', description: 'No UTM warning for NovaTech (no pattern)' },
      { type: 'contains', value: 'novatechsolutions.com/new', description: 'Uses the provided URL as-is' },
      { type: 'contains', value: 'Shall I', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'NC-030',
    prompt: 'LP for Luminance: https://www.luminancebeauty.com/sale?utm_source=cm360',
    category: 'naming-convention',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Warns about incomplete UTMs \u2014 has utm_source but missing utm_medium and utm_campaign',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'nc030_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc030_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'nc030_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'The URL has incomplete UTM parameters — utm_source=cm360 is present, but it\'s missing the other UTM parameters that existing Luminance Beauty landing pages include:\n\n**Missing:**\n- utm_medium=display\n- utm_campaign=luminance-beauty-sale\n\nThe complete URL should be:\n\n- **https://www.luminancebeauty.com/sale?utm_source=cm360&utm_medium=display&utm_campaign=luminance-beauty-sale**\n\nWould you like me to add the missing UTM parameters?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'utm_medium', description: 'Warns about missing utm_medium' },
      { type: 'contains', value: 'utm_campaign', description: 'Warns about missing utm_campaign' },
      { type: 'contains', value: 'incomplete', description: 'Identifies UTMs as incomplete' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Export all naming convention prompts
// ---------------------------------------------------------------------------

export const NAMING_CONVENTION_PROMPTS: TestPrompt[] = [
  ...campaignNaming,
  ...placementNaming,
  ...creativeNaming,
  ...adNaming,
  ...landingPageUtm,
];
