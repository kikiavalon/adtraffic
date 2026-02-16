/**
 * Multi-turn conversation flows for clarifying-question scenarios.
 *
 * Each flow tests that Kiki progressively gathers missing information
 * across multiple turns rather than guessing or refusing to help.
 *
 * 5 flows, 3 turns each (15 turns total).
 */

import type { ConversationFlow } from './conversation-flows.js';

export const CLARIFYING_QUESTION_FLOWS: ConversationFlow[] = [
  // -----------------------------------------------------------------------
  // Flow CQ-001: Incremental placement creation
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-CQ-001',
    name: 'Incremental placement creation',
    description: 'User provides placement details one piece at a time across three turns',
    turns: [
      {
        userMessage: 'I want to add a placement',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'I can set up a placement! I need a few details:\n\n1. **Which advertiser and campaign** should this placement go in?\n2. **Which site** (publisher) — e.g., ESPN, CNN, Forbes?\n3. **Ad size** — e.g., 300x250, 728x90\n\nWhich advertiser are we working with?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
          { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
          { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
        ],
        description: 'Initial vague request — asks which advertiser and campaign',
      },
      {
        userMessage: 'For Apex Motors, the Q1 campaign',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000', searchString: 'Q1' } },
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_sites', input: { profileId: '12345' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Got it — **Apex Motors**, **Q1 2026 Display Awareness** campaign (90024).\n\nNow I need:\n\n1. **Which site?** Available:\n   - ESPN, CNN, Forbes, Bloomberg, NYTimes, WashPost, TheVerge, TechCrunch, Hulu, Spotify\n\n2. **What ad size?** Common options:\n   - 300x250 (medium rectangle)\n   - 728x90 (leaderboard)\n   - 970x250 (billboard)\n   - 160x600 (wide skyscraper)',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Apex', description: 'Confirms Apex Motors resolved' },
          { type: 'contains', value: 'Q1', description: 'Confirms Q1 campaign resolved' },
          { type: 'contains', value: 'site', description: 'Asks for site' },
          { type: 'contains', value: 'size', description: 'Asks for ad size' },
          { type: 'not_contains', value: 'cm360_create_placement', description: 'Still does NOT create — missing site and size' },
        ],
        description: 'Resolves advertiser and campaign, asks for remaining details (site and size)',
      },
      {
        userMessage: 'ESPN, 300x250',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_5', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'ESPN' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Here\'s the placement I\'d create:\n\n**Placement Preview:**\n- **Advertiser:** Apex Motors (90000)\n- **Campaign:** Apex Q1 2026 Display Awareness (90024)\n- **Site:** ESPN.com (90007)\n- **Size:** 300x250\n- **Dates:** 2026-01-01 to 2026-03-31\n\nShall I go ahead and create it?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Apex', description: 'Maintains advertiser context' },
          { type: 'contains', value: 'ESPN', description: 'Correct site' },
          { type: 'contains', value: '300x250', description: 'Correct size' },
          { type: 'contains', value: 'Shall I', description: 'Asks for confirmation before creating' },
        ],
        description: 'Shows placement preview with all resolved details and asks for confirmation',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow CQ-002: Vague to specific ad setup
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-CQ-002',
    name: 'Vague to specific ad setup',
    description: 'User starts with a very vague ad request and progressively narrows down',
    turns: [
      {
        userMessage: 'Set up some ads',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'I can help set up ads! In CM360, an ad links a creative to a placement. To get started:\n\n**Which advertiser** are we setting up ads for?\n\nI can list the available advertisers if that helps.',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'advertiser', description: 'Asks which advertiser' },
          { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create ads without details' },
        ],
        description: 'Vague request — asks for advertiser first',
      },
      {
        userMessage: 'Vanguard Athletics',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Vanguard' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90004' } },
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90004' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Found **Vanguard Athletics** (90004). Here\'s what they have:\n\n**Campaigns:**\n1. Vanguard Q1 2026 Display Awareness\n2. Vanguard Q2 2026 Video Retargeting\n3. Vanguard Q3 2026 Mobile Launch\n\n**Creatives:**\n- Vanguard_300x250_v1 (300x250)\n- Vanguard_728x90_v1 (728x90)\n\nWhich campaign should the ads go in, and which creatives should I assign?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Vanguard', description: 'Resolves advertiser' },
          { type: 'contains', value: 'campaign', description: 'Lists campaigns for selection' },
          { type: 'contains', value: 'creative', description: 'Lists creatives for assignment' },
          { type: 'not_contains', value: 'cm360_create_ad', description: 'Still does NOT create — awaiting campaign and creative selection' },
        ],
        description: 'Resolves advertiser, lists campaigns and creatives, asks which to use',
      },
      {
        userMessage: 'The first campaign, use both creatives',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_5', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90036' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Here\'s the ad setup I\'d create for **Vanguard Q1 2026 Display Awareness**:\n\n| # | Creative | Placement | Size |\n|---|---|---|---|\n| 1 | Vanguard_300x250_v1 | ESPN_Vanguard_300x250 | 300x250 |\n| 2 | Vanguard_728x90_v1 | CNN_Vanguard_728x90 | 728x90 |\n\nEach ad links a size-matched creative to its corresponding placement.\n\nShall I create these 2 ads?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Vanguard', description: 'Maintains advertiser context' },
          { type: 'contains', value: 'Q1', description: 'Resolves "first campaign" to Q1' },
          { type: 'contains', value: 'Creative', description: 'Shows creative assignments' },
          { type: 'contains', value: 'Placement', description: 'Shows placement assignments' },
          { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
        ],
        description: 'Shows ad preview with creative-to-placement mapping and asks for confirmation',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow CQ-003: Tag request without context
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-CQ-003',
    name: 'Tag request without context',
    description: 'User requests tag generation but provides no context, then narrows down across turns',
    turns: [
      {
        userMessage: 'I need to generate tags',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'I can generate ad serving tags! Tags are generated from placements, so I need to know:\n\n1. **Which advertiser** are we working with?\n2. **Which campaign** should I generate tags for?\n\nWant me to list the advertisers?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
          { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
          { type: 'not_contains', value: 'cm360_generate_tags', description: 'Does NOT generate tags without context' },
        ],
        description: 'No context — asks which advertiser and campaign',
      },
      {
        userMessage: 'For Meridian Financial',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Meridian' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90002' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Found **Meridian Financial** (90002). They have 3 campaigns:\n\n1. Meridian Q1 2026 Display\n2. Meridian Q2 2026 Video Conversions\n3. Meridian Q3 2026 Mobile Retargeting\n\nCould you tell me which campaign I should generate tags for?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Meridian', description: 'Resolves advertiser' },
          { type: 'contains', value: 'Q1', description: 'Lists Q1 campaign option' },
          { type: 'contains', value: 'Q2', description: 'Lists Q2 campaign option' },
          { type: 'contains', value: 'which campaign', description: 'Asks which campaign (multiple exist)' },
          { type: 'not_contains', value: 'cm360_generate_tags', description: 'Still does NOT generate — multiple campaigns to choose from' },
        ],
        description: 'Resolves advertiser, finds multiple campaigns, asks which one',
      },
      {
        userMessage: 'The Q1 campaign',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90030' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'The **Meridian Q1 2026 Display** campaign has 3 placements:\n\n| # | Placement | Site | Size |\n|---|---|---|---|\n| 1 | Forbes_Meridian_300x250 | Forbes | 300x250 |\n| 2 | Bloomberg_Meridian_728x90 | Bloomberg | 728x90 |\n| 3 | CNN_Meridian_970x250 | CNN | 970x250 |\n\nShould I generate tags for **all 3 placements**, or just specific ones?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Meridian Q1', description: 'Resolves the Q1 campaign' },
          { type: 'contains', value: 'placement', description: 'Lists available placements' },
          { type: 'contains', value: 'all', description: 'Offers to generate for all or specific placements' },
        ],
        description: 'Resolves campaign, lists placements, asks which ones to generate tags for',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow CQ-004: User provides info incrementally for campaign creation
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-CQ-004',
    name: 'Incremental campaign creation with clarifying questions',
    description: 'User provides campaign info piece by piece — Kiki asks only for what is still missing at each turn',
    turns: [
      {
        userMessage: 'I need a new campaign',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'I\'d be happy to create a campaign! I need:\n\n1. **Which advertiser** is this for?\n2. **Campaign name** — what should we call it?\n3. **Start and end dates** — when does it run?\n\nWhich advertiser are we working with?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
          { type: 'contains', value: 'name', description: 'Asks for campaign name' },
          { type: 'contains', value: 'date', description: 'Asks for dates' },
          { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
        ],
        description: 'No details — asks for all required information',
      },
      {
        userMessage: 'It\'s for Crestview Hotels, call it Summer Push',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Crestview' } },
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90005' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Great — **Crestview Hotels** (90005), and we\'ll call it **Summer Push**.\n\nI just need the dates:\n\n**When does the campaign run?** — start date and end date (e.g., "July through September" or "2026-07-01 to 2026-09-30").',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Crestview Hotels', description: 'Confirms advertiser' },
          { type: 'contains', value: 'Summer Push', description: 'Confirms campaign name' },
          { type: 'contains', value: 'date', description: 'Asks for the only missing piece — dates' },
          { type: 'not_contains', value: 'which advertiser', description: 'Does NOT re-ask for advertiser' },
          { type: 'not_contains', value: 'campaign name', description: 'Does NOT re-ask for name' },
          { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create yet — dates still missing' },
        ],
        description: 'Advertiser and name provided — asks only for dates (the remaining missing piece)',
      },
      {
        userMessage: 'July through September 2026',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'Here\'s the campaign I\'ll create:\n\n**Campaign Preview:**\n- **Advertiser:** Crestview Hotels (90005)\n- **Name:** Summer Push\n- **Start Date:** 2026-07-01\n- **End Date:** 2026-09-30\n- **Landing Page:** Crestview Hotels Homepage\n\nShall I go ahead and create it?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Crestview Hotels', description: 'Maintains advertiser context' },
          { type: 'contains', value: 'Summer Push', description: 'Maintains campaign name from prior turn' },
          { type: 'contains', value: '2026-07-01', description: 'Converts "July" to YYYY-MM-DD start' },
          { type: 'contains', value: '2026-09-30', description: 'Converts "September" to YYYY-MM-DD end' },
          { type: 'contains', value: 'Shall I go ahead', description: 'Asks for confirmation before creating' },
        ],
        description: 'Shows complete preview with natural-language dates converted to YYYY-MM-DD and asks for confirmation',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow CQ-005: Recovering from ambiguity
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-CQ-005',
    name: 'Recovering from ambiguity',
    description: 'User says "news site" which matches multiple publishers; Kiki disambiguates across turns',
    turns: [
      {
        userMessage: 'Create a placement on the news site',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'We have several news-oriented sites in the account — could you tell me which one you mean?\n\n- **CNN** (90008)\n- **NYTimes** (90011)\n- **WashPost** (90012)\n- **Bloomberg** (90010)\n- **Forbes** (90009)\n\nAlso, I\'ll need:\n1. **Which advertiser and campaign** is this for?\n2. **What ad size?**',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'CNN', description: 'Lists CNN as a news site option' },
          { type: 'contains', value: 'NYTimes', description: 'Lists NYTimes as a news site option' },
          { type: 'contains', value: 'WashPost', description: 'Lists WashPost as a news site option' },
          { type: 'contains', value: 'which', description: 'Asks user to choose' },
          { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create — ambiguous site' },
        ],
        description: '"News site" is ambiguous — lists matching sites and asks user to choose',
      },
      {
        userMessage: 'CNN',
        mockResponses: [
          {
            content: [
              {
                type: 'text',
                text: 'CNN it is! Now I need:\n\n1. **Which advertiser** is this placement for?\n2. **Which campaign** should it go in?\n3. **What ad size?** — e.g., 300x250, 728x90, 970x250\n\nWhich advertiser are we working with?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'CNN', description: 'Confirms CNN selection' },
          { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
          { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
          { type: 'contains', value: 'size', description: 'Asks for size' },
          { type: 'not_contains', value: 'cm360_create_placement', description: 'Still does NOT create — missing advertiser, campaign, size' },
        ],
        description: 'Site resolved — now asks for remaining details (advertiser, campaign, size)',
      },
      {
        userMessage: 'For Apex Q1, 728x90',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Apex' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000', searchString: 'Q1' } },
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'CNN' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              {
                type: 'text',
                text: 'Here\'s the placement I\'d create:\n\n**Placement Preview:**\n- **Advertiser:** Apex Motors (90000)\n- **Campaign:** Apex Q1 2026 Display Awareness (90024)\n- **Site:** CNN.com (90008)\n- **Size:** 728x90\n- **Dates:** 2026-01-01 to 2026-03-31\n\nShall I create it?',
              },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Apex', description: 'Resolves Apex Motors' },
          { type: 'contains', value: 'Q1', description: 'Resolves Q1 campaign' },
          { type: 'contains', value: 'CNN', description: 'Maintains CNN from earlier turn' },
          { type: 'contains', value: '728x90', description: 'Correct ad size' },
          { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation before creating' },
        ],
        description: 'All details resolved — shows preview with CNN from turn 2 and new details from turn 3',
      },
    ],
  },
];
