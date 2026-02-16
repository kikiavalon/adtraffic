/**
 * Multi-turn naming convention enforcement flows.
 *
 * These test that Kiki maintains naming convention awareness across
 * conversation turns, offers corrections, respects user overrides,
 * and auto-suggests correct names when the user defers.
 */

import type { ConversationFlow } from './conversation-flows.js';

// ---------------------------------------------------------------------------
// Flow NC-001: User accepts naming suggestion (4 turns)
// ---------------------------------------------------------------------------

const flowAcceptSuggestion: ConversationFlow = {
  id: 'FLOW-NC-001',
  name: 'User accepts naming suggestion',
  description: 'User proposes a bad campaign name, Kiki warns, user provides details, Kiki builds correct name, then auto-suggests placement name',
  turns: [
    {
      userMessage: "Create a campaign for Apex Motors called 'Spring Promo' for Q2",
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc1_t1_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc1_t1_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc1_t1_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'I noticed that existing Apex Motors campaigns follow a naming convention:\n\n- Apex Q1 2026 Display Awareness\n- Apex Q2 2026 Video Conversions\n- Apex Q3 2026 Mobile Retargeting\n\nThe pattern is: **Apex Q# 2026 [Channel] [Objective]**\n\nThe name "Spring Promo" doesn\'t follow this convention. To build the correct name, I need to know:\n\n1. **Channel** \u2014 Display, Video, Mobile, or Cross-Platform?\n2. **Objective** \u2014 Awareness, Conversions, Retargeting, Launch, or Seasonal?\n\nWhat channel and objective should this Q2 campaign target?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
        { type: 'contains', value: 'Apex Q', description: 'Shows existing pattern' },
        { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create with bad name' },
      ],
      description: 'Kiki detects existing Apex campaign pattern and warns about "Spring Promo"',
    },
    {
      userMessage: "Good point. It's a Display campaign for Conversions",
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the campaign with the correct naming convention:\n\n**Campaign Preview:**\n- **Advertiser:** Apex Motors (90000)\n- **Name:** Apex Q2 2026 Display Conversions\n- **Start Date:** 2026-04-01\n- **End Date:** 2026-06-30\n- **Landing Page:** Apex Motors Homepage\n\nShall I go ahead and create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Apex Q2 2026 Display Conversions', description: 'Builds correct name from user inputs' },
        { type: 'contains', value: 'Shall I', description: 'Asks for confirmation' },
      ],
      description: 'Kiki builds the correct campaign name from user-provided channel and objective',
    },
    {
      userMessage: 'Yes, create it',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc1_t3_1', name: 'cm360_create_campaign', input: {
                profileId: '12345',
                advertiserId: '90000',
                name: 'Apex Q2 2026 Display Conversions',
                startDate: '2026-04-01',
                endDate: '2026-06-30',
                defaultLandingPageId: '90017',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Done! **Apex Q2 2026 Display Conversions** has been created.\n\n- **Campaign ID:** 90200\n- **Dates:** 2026-04-01 to 2026-06-30\n\nWould you like to add placements to this campaign?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'created', description: 'Confirms campaign creation' },
        { type: 'contains', value: 'Apex Q2 2026 Display Conversions', description: 'Uses the correct name' },
      ],
      description: 'Campaign created with the convention-compliant name',
    },
    {
      userMessage: 'Now add a placement on ESPN, 300x250',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc1_t4_1', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'ESPN' } },
            { type: 'tool_use', id: 'fnc1_t4_2', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Based on the established placement naming convention, here\'s what I\'d create:\n\n**Placement Preview:**\n- **Campaign:** Apex Q2 2026 Display Conversions\n- **Site:** ESPN.com\n- **Name:** ESPN_Apex_300x250_0426_Standard\n- **Size:** 300x250\n- **Dates:** 2026-04-01 to 2026-06-30\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'ESPN_Apex_300x250_0426_Standard', description: 'Auto-suggests correct placement name' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'Kiki auto-suggests the correct placement name following the convention',
    },
  ],
};

// ---------------------------------------------------------------------------
// Flow NC-002: User insists on their name (3 turns)
// ---------------------------------------------------------------------------

const flowUserInsists: ConversationFlow = {
  id: 'FLOW-NC-002',
  name: 'User insists on their name',
  description: 'User proposes a bad placement name, Kiki warns, user overrides and insists on keeping it, Kiki complies',
  turns: [
    {
      userMessage: "Create a placement called 'test_plcmt' for Luminance on CNN, 728x90, Q2 campaign",
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc2_t1_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc2_t1_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc2_t1_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
            { type: 'tool_use', id: 'fnc2_t1_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90001' } },
            { type: 'tool_use', id: 'fnc2_t1_5', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'CNN' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Heads up \u2014 "test_plcmt" doesn\'t follow the placement naming convention used across this account:\n\n**{Site}_{Adv}_{WxH}_{MMYY}_{Type}**\n\nThe conventional name would be: **CNN_Luminance_728x90_0426_Standard**\n\nWould you like to use the conventional name, or keep "test_plcmt"?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
        { type: 'contains', value: 'CNN_Luminance_728x90', description: 'Suggests the correct name' },
      ],
      description: 'Kiki warns about the placement name but offers the user a choice',
    },
    {
      userMessage: "I know it breaks the convention but keep my name, it's just for testing",
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Understood \u2014 I\'ll use your name for this test placement.\n\n**Placement Preview:**\n- **Campaign:** Luminance Q2 2026 Video Conversions\n- **Site:** CNN.com\n- **Name:** test_plcmt\n- **Size:** 728x90\n- **Dates:** 2026-04-01 to 2026-06-30\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'test_plcmt', description: 'Respects user override and uses their name' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'Kiki accepts the user override and shows preview with the user\'s chosen name',
    },
    {
      userMessage: 'Yes create it',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc2_t3_1', name: 'cm360_create_placement', input: {
                profileId: '12345',
                campaignId: '90028',
                siteId: '90008',
                name: 'test_plcmt',
                width: 728,
                height: 90,
                startDate: '2026-04-01',
                endDate: '2026-06-30',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Done! Placement **test_plcmt** has been created.\n\n- **Placement ID:** 90210\n- **Site:** CNN.com\n- **Size:** 728x90\n\nNote: if you want to rename this later to follow the convention (CNN_Luminance_728x90_0426_Standard), just let me know.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'test_plcmt', description: 'Creates with user\'s original name' },
        { type: 'contains', value: 'created', description: 'Confirms creation' },
      ],
      description: 'Creates the placement with the user\'s chosen name, offers to rename later',
    },
  ],
};

// ---------------------------------------------------------------------------
// Flow NC-003: Multi-entity naming in one flow (5 turns)
// ---------------------------------------------------------------------------

const flowMultiEntity: ConversationFlow = {
  id: 'FLOW-NC-003',
  name: 'Multi-entity naming in one flow',
  description: 'User sets up a campaign and placement, Kiki enforces naming conventions for both entity types across the conversation',
  turns: [
    {
      userMessage: 'I need to set up a new Q3 campaign for Luminance Beauty with placements',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc3_t1_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc3_t1_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Great \u2014 I\'ll help set up a Q3 campaign for Luminance Beauty with placements. Let\'s start with the campaign.\n\nWhat should we call it? And what channel and objective does it target?\n\nFor reference, existing Luminance campaigns follow the format: **Luminance Q# 2026 [Channel] [Objective]**',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Luminance', description: 'Identifies the advertiser' },
        { type: 'contains', value: 'Luminance Q', description: 'Proactively shows the naming convention' },
      ],
      description: 'Kiki proactively mentions the naming convention when asking for campaign details',
    },
    {
      userMessage: "Call the campaign 'Lumi Summer Campaign'",
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc3_t2_1', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'The name "Lumi Summer Campaign" doesn\'t match the established naming convention for Luminance Beauty campaigns:\n\n**Luminance Q# 2026 [Channel] [Objective]**\n\nExisting campaigns:\n- Luminance Q1 2026 Display Awareness\n- Luminance Q2 2026 Video Conversions\n\nCould you tell me the channel and objective so I can build the correct name? For example: "Luminance Q3 2026 Video Awareness"',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'naming convention', description: 'Warns about naming convention' },
        { type: 'contains', value: 'Luminance Q', description: 'Shows the correct format' },
      ],
      description: 'Kiki warns about the non-standard campaign name',
    },
    {
      userMessage: 'Fine, make it Luminance Q3 2026 Video Awareness',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc3_t3_1', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90001' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the campaign preview:\n\n**Campaign Preview:**\n- **Advertiser:** Luminance Beauty (90001)\n- **Name:** Luminance Q3 2026 Video Awareness\n- **Start Date:** 2026-07-01\n- **End Date:** 2026-09-30\n- **Landing Page:** Luminance Beauty Homepage\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Luminance Q3 2026 Video Awareness', description: 'Uses the correct name' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'Kiki shows preview with the convention-compliant name',
    },
    {
      userMessage: 'Yes, create it. Now add a 300x250 on ESPN',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc3_t4_1', name: 'cm360_create_campaign', input: {
                profileId: '12345',
                advertiserId: '90001',
                name: 'Luminance Q3 2026 Video Awareness',
                startDate: '2026-07-01',
                endDate: '2026-09-30',
                defaultLandingPageId: '90020',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc3_t4_2', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'ESPN' } },
            { type: 'tool_use', id: 'fnc3_t4_3', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90001' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Campaign created! **Luminance Q3 2026 Video Awareness** (ID: 90220)\n\nNow for the placement \u2014 based on the naming convention, here\'s what I\'d create:\n\n**Placement Preview:**\n- **Campaign:** Luminance Q3 2026 Video Awareness\n- **Site:** ESPN.com\n- **Name:** ESPN_Luminance_300x250_0726_Standard\n- **Size:** 300x250\n- **Dates:** 2026-07-01 to 2026-09-30\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'created', description: 'Confirms campaign creation' },
        { type: 'contains', value: 'ESPN_Luminance_300x250_0726_Standard', description: 'Auto-suggests correct placement name' },
      ],
      description: 'Creates campaign, then auto-suggests the correct placement name',
    },
    {
      userMessage: 'Looks good, create it',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc3_t5_1', name: 'cm360_create_placement', input: {
                profileId: '12345',
                campaignId: '90220',
                siteId: '90007',
                name: 'ESPN_Luminance_300x250_0726_Standard',
                width: 300,
                height: 250,
                startDate: '2026-07-01',
                endDate: '2026-09-30',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Done! Placement **ESPN_Luminance_300x250_0726_Standard** has been created.\n\n- **Placement ID:** 90221\n- **Campaign:** Luminance Q3 2026 Video Awareness\n- **Site:** ESPN.com\n- **Size:** 300x250\n\nWould you like to add more placements to this campaign?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'ESPN_Luminance_300x250_0726_Standard', description: 'Creates with the correct name' },
        { type: 'contains', value: 'created', description: 'Confirms creation' },
      ],
      description: 'Creates the placement with the auto-suggested convention-compliant name',
    },
  ],
};

// ---------------------------------------------------------------------------
// Flow NC-004: UTM correction flow (4 turns)
// ---------------------------------------------------------------------------

const flowUtmCorrection: ConversationFlow = {
  id: 'FLOW-NC-004',
  name: 'UTM correction flow',
  description: 'User creates landing pages for two advertisers \u2014 one with UTM pattern (Meridian) and one without (NovaTech). Kiki warns appropriately.',
  turns: [
    {
      userMessage: "Create a landing page for Meridian Financial called 'Investment Guide' at https://www.meridianfinancial.com/invest-guide",
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc4_t1_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc4_t1_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc4_t1_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90002' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'I noticed that existing Meridian Financial landing pages include UTM tracking parameters:\n\n- utm_source=cm360\n- utm_medium=display\n- utm_campaign=meridian-financial-{suffix}\n\nThe URL you provided is missing these UTM parameters. The corrected URL would be:\n\n- **https://www.meridianfinancial.com/invest-guide?utm_source=cm360&utm_medium=display&utm_campaign=meridian-financial-invest-guide**\n\nWould you like me to add the UTM parameters?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'UTM', description: 'Warns about missing UTMs' },
        { type: 'contains', value: 'utm_source=cm360', description: 'Shows expected UTMs' },
      ],
      description: 'Kiki detects Meridian UTM pattern and warns about missing params',
    },
    {
      userMessage: 'Oh right, add the UTMs',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the landing page with UTMs added:\n\n**Landing Page Preview:**\n- **Advertiser:** Meridian Financial (90002)\n- **Name:** Investment Guide\n- **URL:** https://www.meridianfinancial.com/invest-guide?utm_source=cm360&utm_medium=display&utm_campaign=meridian-financial-invest-guide\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'utm_source=cm360', description: 'Shows corrected URL with UTMs' },
        { type: 'contains', value: 'utm_campaign=meridian-financial-invest-guide', description: 'Correct utm_campaign slug' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'Kiki shows the corrected URL with proper UTM parameters',
    },
    {
      userMessage: 'Yes create it',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc4_t3_1', name: 'cm360_create_landing_page', input: {
                profileId: '12345',
                advertiserId: '90002',
                name: 'Investment Guide',
                url: 'https://www.meridianfinancial.com/invest-guide?utm_source=cm360&utm_medium=display&utm_campaign=meridian-financial-invest-guide',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Done! Landing page **Investment Guide** has been created for Meridian Financial.\n\n- **URL:** https://www.meridianfinancial.com/invest-guide?utm_source=cm360&utm_medium=display&utm_campaign=meridian-financial-invest-guide\n\nAnything else you need?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'created', description: 'Confirms creation' },
        { type: 'contains', value: 'utm_source=cm360', description: 'Created with correct UTMs' },
      ],
      description: 'Creates the landing page with the corrected UTM URL',
    },
    {
      userMessage: 'Create another one for NovaTech: https://www.novatechsolutions.com/demo',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc4_t4_1', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'NovaTech' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc4_t4_2', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90003' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the landing page I\'d create:\n\n**Landing Page Preview:**\n- **Advertiser:** NovaTech Solutions (90003)\n- **Name:** NovaTech Solutions Demo\n- **URL:** https://www.novatechsolutions.com/demo\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'not_contains', value: 'UTM', description: 'No UTM warning for NovaTech (no existing pattern)' },
        { type: 'contains', value: 'novatechsolutions.com/demo', description: 'Uses URL as-is without adding UTMs' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'No UTM warning for NovaTech because their existing pages have no UTM pattern',
    },
  ],
};

// ---------------------------------------------------------------------------
// Flow NC-005: Pattern detection across operations (4 turns)
// ---------------------------------------------------------------------------

const flowPatternDetection: ConversationFlow = {
  id: 'FLOW-NC-005',
  name: 'Pattern detection across operations',
  description: 'User creates two correctly-named placements, then tries a bad name on the third. Kiki warns because it has seen the pattern reinforced.',
  turns: [
    {
      userMessage: "Create a 300x250 placement on ESPN for Apex Q1 \u2014 name it ESPN_Apex_300x250_0126_Standard",
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'fnc5_t1_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc5_t1_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
            { type: 'tool_use', id: 'fnc5_t1_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'ESPN' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc5_t1_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
            { type: 'tool_use', id: 'fnc5_t1_5', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'The name follows the established placement convention. Here\'s the preview:\n\n**Placement Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Site:** ESPN.com\n- **Name:** ESPN_Apex_300x250_0126_Standard\n- **Size:** 300x250\n- **Dates:** 2026-01-01 to 2026-03-31\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'not_contains', value: 'naming convention', description: 'No warning for correct name' },
        { type: 'contains', value: 'ESPN_Apex_300x250_0126_Standard', description: 'Uses the correct name' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'First placement with correct naming \u2014 no warning',
    },
    {
      userMessage: 'Yes create it. Now another one on CNN, 728x90',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc5_t2_1', name: 'cm360_create_placement', input: {
                profileId: '12345',
                campaignId: '90024',
                siteId: '90007',
                name: 'ESPN_Apex_300x250_0126_Standard',
                width: 300,
                height: 250,
                startDate: '2026-01-01',
                endDate: '2026-03-31',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'fnc5_t2_2', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'CNN' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'ESPN placement created! (ID: 90230)\n\nFor the CNN placement, following the same convention:\n\n**Placement Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Site:** CNN.com\n- **Name:** CNN_Apex_728x90_0126_Standard\n- **Size:** 728x90\n- **Dates:** 2026-01-01 to 2026-03-31\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'CNN_Apex_728x90_0126_Standard', description: 'Auto-suggests correct second placement name' },
        { type: 'contains', value: 'created', description: 'Confirms first placement created' },
      ],
      description: 'Creates first placement and auto-suggests correct name for the second',
    },
    {
      userMessage: "Create it. One more on Forbes, 970x250, call it 'Forbes Banner'",
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use', id: 'fnc5_t3_1', name: 'cm360_create_placement', input: {
                profileId: '12345',
                campaignId: '90024',
                siteId: '90008',
                name: 'CNN_Apex_728x90_0126_Standard',
                width: 728,
                height: 90,
                startDate: '2026-01-01',
                endDate: '2026-03-31',
              },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'CNN placement created! (ID: 90231)\n\nHowever, the name "Forbes Banner" breaks the naming convention we\'ve been using for this campaign\'s placements:\n\n- ESPN_Apex_300x250_0126_Standard\n- CNN_Apex_728x90_0126_Standard\n\nThe correct name for this placement would be:\n\n- **Forbes_Apex_970x250_0126_Standard**\n\nWould you like to use the conventional name?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'naming convention', description: 'Warns about breaking the pattern' },
        { type: 'contains', value: 'Forbes_Apex_970x250_0126_Standard', description: 'Suggests the correct name' },
        { type: 'contains', value: 'CNN placement created', description: 'Confirms second placement created' },
      ],
      description: 'Kiki warns when the third placement name breaks the pattern established by the first two',
    },
    {
      userMessage: 'Use the correct name',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the updated preview:\n\n**Placement Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Site:** Forbes.com\n- **Name:** Forbes_Apex_970x250_0126_Standard\n- **Size:** 970x250\n- **Dates:** 2026-01-01 to 2026-03-31\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Forbes_Apex_970x250_0126_Standard', description: 'Shows the correct name in preview' },
        { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
      ],
      description: 'Kiki shows preview with the convention-correct name after user agrees to use it',
    },
  ],
};

// ---------------------------------------------------------------------------
// Export all naming convention flows
// ---------------------------------------------------------------------------

export const NAMING_CONVENTION_FLOWS: ConversationFlow[] = [
  flowAcceptSuggestion,
  flowUserInsists,
  flowMultiEntity,
  flowUtmCorrection,
  flowPatternDetection,
];
