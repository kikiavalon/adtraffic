/**
 * Clarifying-questions test prompts.
 *
 * These test that Kiki asks targeted questions when user requests are
 * ambiguous or incomplete, rather than guessing or proceeding without
 * sufficient information.
 *
 * Sub-categories:
 *   A. Missing Campaign Parameters     (CQ-001 to CQ-007)
 *   B. Missing Placement Parameters    (CQ-008 to CQ-014)
 *   C. Missing Ad/Creative Parameters  (CQ-015 to CQ-021)
 *   D. Ambiguous References            (CQ-022 to CQ-028)
 *   E. Complex Multi-Entity Requests   (CQ-029 to CQ-035)
 *
 * Mock data reference (seeded from mock-data-store.ts):
 *   Profile ID: 12345 | Account: 67890 (Demo Agency)
 *   Advertisers: 90000 Apex Motors, 90001 Luminance Beauty, 90002 Meridian Financial,
 *                90003 NovaTech Solutions, 90004 Vanguard Athletics, 90005 Crestview Hotels,
 *                90006 Harvest Organics
 *   Sites: 90007 ESPN, 90008 CNN, 90009 Forbes, 90010 Bloomberg, 90011 NYTimes,
 *          90012 WashPost, 90013 TheVerge, 90014 TechCrunch, 90015 Hulu, 90016 Spotify
 */

import type { TestPrompt } from './test-prompts.js';

// ---------------------------------------------------------------------------
// A. Missing Campaign Parameters (CQ-001 to CQ-007)
// ---------------------------------------------------------------------------

const missingCampaignParams: TestPrompt[] = [
  {
    id: 'CQ-001',
    prompt: 'Create a campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Everything missing — asks for advertiser, campaign name, and dates without proceeding',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'d be happy to help create a campaign! I need a few details first:\n\n1. **Which advertiser** should this campaign be for?\n2. **Campaign name** — what should we call it?\n3. **Start and end dates** — when does it run?\n\nWould you like me to list the available advertisers?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks which advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'contains', value: 'date', description: 'Asks for dates' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-002',
    prompt: 'Create a campaign for Apex Motors',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Resolves Apex Motors, then asks for campaign name and dates — does NOT ask for advertiser again',
    mockToolSequence: [
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
          {
            type: 'text',
            text: 'Got it — **Apex Motors** (90000). To create the campaign I still need:\n\n1. **Campaign name** — what should we call it?\n2. **Start and end dates** — when does it run?\n\nFor example: "Apex Q2 2026 Display" running April through June.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex Motors', description: 'Confirms the resolved advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'contains', value: 'date', description: 'Asks for dates' },
      { type: 'not_contains', value: 'which advertiser', description: 'Does NOT re-ask for advertiser' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-003',
    prompt: 'New campaign, Q3, for the beauty company',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Resolves "beauty company" to Luminance Beauty, infers Q3 dates, asks for exact campaign name and objective/channel',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I\'m guessing you mean **Luminance Beauty** (90001) — our beauty advertiser. And Q3 would be July 1 through September 30, 2026.\n\nI just need a couple more things:\n\n1. **Campaign name** — what should we call it? Something like "Luminance Beauty Q3 2026 Display"?\n2. **Channel / objective** — display, video, mobile?\n\nLet me know and I\'ll put together a preview.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Luminance Beauty', description: 'Resolves beauty company to Luminance' },
      { type: 'contains', value: 'name', description: 'Asks for exact campaign name' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-004',
    prompt: 'I need a campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Rephrased version of CQ-001 — asks for advertiser, name, and dates',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Sure thing! To set up a campaign, I\'ll need:\n\n1. **Which advertiser** is this for?\n2. **Campaign name** — what should we call it?\n3. **Start and end dates** — when should it run?\n\nWant me to pull up the list of advertisers to start?',
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
  },
  {
    id: 'CQ-005',
    prompt: 'Create a Q1 campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Has Q1 date range inferrable but advertiser and name are missing — asks for both',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A Q1 campaign — got it, so January 1 through March 31, 2026. I still need:\n\n1. **Which advertiser** should this be for?\n2. **Campaign name** — e.g., "[Advertiser] Q1 2026 Display"\n\nWhich advertiser are we working with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks which advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-006',
    prompt: 'New campaign for NovaTech starting next month',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Resolves NovaTech, infers start date from "next month", asks for end date and campaign name',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'NovaTech' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Found **NovaTech Solutions** (90003). Starting next month — I\'ll use March 1, 2026 as the start.\n\nI need two more things:\n\n1. **What end date** should I use — when does it wrap up?\n2. **Campaign name** — what should we call it?\n\nFor example: "NovaTech March 2026 Performance"',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'NovaTech', description: 'Resolves advertiser' },
      { type: 'contains', value: 'end date', description: 'Asks for missing end date' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-007',
    prompt: 'Set up a campaign for the holidays',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Advertiser, exact dates, and name are all missing — asks for all three',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A holiday campaign — great idea! I need a few things to get started:\n\n1. **Which advertiser** is this for?\n2. **Campaign name** — e.g., "Holiday 2026 Display Push"\n3. **Exact dates** — "the holidays" typically means late November through December, but I want to confirm. What start and end dates should I use?\n\nWant me to list the advertisers?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks which advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'contains', value: 'date', description: 'Asks for exact dates' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
];

// ---------------------------------------------------------------------------
// B. Missing Placement Parameters (CQ-008 to CQ-014)
// ---------------------------------------------------------------------------

const missingPlacementParams: TestPrompt[] = [
  {
    id: 'CQ-008',
    prompt: 'Create a placement',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Everything missing — asks for advertiser, campaign, site, and ad size',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I can set up a placement! I\'ll need:\n\n1. **Which advertiser and campaign** should this placement go in?\n2. **Which site** (publisher) — e.g., ESPN, CNN, Forbes?\n3. **Ad size** — e.g., 300x250 (medium rectangle), 728x90 (leaderboard), 970x250 (billboard)\n\nWhich advertiser are we working with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'site', description: 'Asks for site' },
      { type: 'contains', value: 'size', description: 'Asks for ad size' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-009',
    prompt: 'Add a placement to the Apex Q1 campaign',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_sites'],
    expectedBehavior: 'Resolves Apex Motors and Q1 campaign via tool calls, then asks for site and size with available options',
    mockToolSequence: [
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
            text: 'Found the **Apex Q1 2026 Display Awareness** campaign (90024). Now I need:\n\n1. **Which site?** Available options:\n   - ESPN, CNN, Forbes, Bloomberg, NYTimes, WashPost, TheVerge, TechCrunch, Hulu, Spotify\n\n2. **What ad size?** Common sizes:\n   - 300x250 (medium rectangle)\n   - 728x90 (leaderboard)\n   - 970x250 (billboard)\n   - 160x600 (wide skyscraper)\n\nWhich site and size would you like?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex', description: 'Resolves Apex Motors' },
      { type: 'contains', value: 'Q1', description: 'Resolves Q1 campaign' },
      { type: 'contains', value: 'site', description: 'Asks which site' },
      { type: 'contains', value: 'size', description: 'Asks for ad size' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-010',
    prompt: 'Create a 300x250 placement',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Has size but campaign and site are missing — asks for both',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A 300x250 (medium rectangle) — solid choice. I still need:\n\n1. **Which campaign** should this placement go in? (I\'ll need the advertiser too, if I don\'t know it yet.)\n2. **Which site** (publisher) — e.g., ESPN, CNN, Forbes?\n\nWhich advertiser and campaign are we working with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'site', description: 'Asks for site' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-011',
    prompt: 'Put an ad on ESPN',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Has the site (ESPN) but advertiser, campaign, and size are missing',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'ESPN — great publisher choice. To place an ad there, I need:\n\n1. **Which advertiser** is this for?\n2. **Which campaign** should the placement go in?\n3. **What ad size?** — e.g., 300x250, 728x90, 970x250\n\nWhich advertiser are we working with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'size', description: 'Asks for ad size' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-012',
    prompt: 'I need a placement on Forbes for Meridian',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Resolves Meridian Financial and Forbes, finds multiple campaigns, asks which campaign and what size',
    mockToolSequence: [
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
            text: 'Found **Meridian Financial** (90002). They have multiple campaigns:\n\n1. Meridian Q1 2026 Display\n2. Meridian Q2 2026 Video Conversions\n3. Meridian Q3 2026 Mobile Retargeting\n\nI need two things:\n\n1. Could you tell me which campaign the Forbes placement should go in?\n2. **What ad size?** — e.g., 300x250, 728x90, 970x250\n\nWhich campaign?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Meridian', description: 'Resolves Meridian Financial' },
      { type: 'contains', value: 'which campaign', description: 'Asks which campaign (multiple exist)' },
      { type: 'contains', value: 'size', description: 'Asks for ad size' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-013',
    prompt: 'Add a leaderboard to the first campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Knows leaderboard = 728x90, but which advertiser\'s first campaign? Which site? Asks both.',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A leaderboard (728x90) — got it. But I need more context:\n\n1. **Which advertiser\'s** first campaign? We have 7 advertisers in the account — could you tell me which advertiser you mean?\n2. **Which site** should this go on?\n\nWant me to list the advertisers so we can narrow it down?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks which advertiser' },
      { type: 'contains', value: 'site', description: 'Asks which site' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-014',
    prompt: 'Set up placements for the new campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Completely ambiguous — asks which campaign, which sites, what sizes, how many',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'d love to help set up placements! I need a few details:\n\n1. Could you tell me which campaign you\'re referring to? (And which advertiser?)\n2. **Which sites** should the placements go on?\n3. **What ad sizes** do you need?\n4. **How many placements** — one per site, or multiple sizes per site?\n\nLet\'s start with the advertiser and campaign.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which campaign', description: 'Asks which campaign' },
      { type: 'contains', value: 'site', description: 'Asks which sites' },
      { type: 'contains', value: 'size', description: 'Asks what sizes' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
];

// ---------------------------------------------------------------------------
// C. Missing Ad/Creative Parameters (CQ-015 to CQ-021)
// ---------------------------------------------------------------------------

const missingAdCreativeParams: TestPrompt[] = [
  {
    id: 'CQ-015',
    prompt: 'Create an ad',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Everything missing — asks for advertiser, campaign, placement, and creative',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I can help create an ad! An ad in CM360 links a creative to a placement. I\'ll need:\n\n1. **Which advertiser** is this for?\n2. **Which campaign** and **placement** should the ad go on?\n3. **Which creative** should be assigned to it?\n\nWant me to start by listing the advertisers?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'placement', description: 'Asks for placement' },
      { type: 'contains', value: 'creative', description: 'Asks for creative' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-016',
    prompt: 'Link the creative to the placement',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Both "the creative" and "the placement" are unresolvable without context — asks which ones',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'d be happy to link a creative to a placement! But I need to know which ones you mean:\n\n1. I\'ll need to know which creative — the advertiser and creative name/ID.\n2. And also which placement — the campaign and placement name/ID.\n\nCan you tell me which advertiser we\'re working with? I\'ll pull up their creatives and placements.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which creative', description: 'Asks which creative' },
      { type: 'contains', value: 'which placement', description: 'Asks which placement' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-017',
    prompt: 'Set up ads for Vanguard Athletics',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Resolves Vanguard, lists their campaigns, asks which campaign and which creatives to assign',
    mockToolSequence: [
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
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Found **Vanguard Athletics** (90004). They have 3 campaigns:\n\n1. Vanguard Q1 2026 Display Awareness\n2. Vanguard Q2 2026 Video Retargeting\n3. Vanguard Q3 2026 Mobile Launch\n\nTo set up ads, I need to know which campaign the ads should go in, and which creatives to assign to which placements.\n\nWant me to list their creatives and placements for a specific campaign?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Vanguard', description: 'Resolves Vanguard Athletics' },
      { type: 'contains', value: 'which campaign', description: 'Asks which campaign' },
      { type: 'contains', value: 'creative', description: 'Asks about creatives' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-018',
    prompt: 'Assign the 300x250 creative to all placements',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Has a size hint but no advertiser or campaign context — asks for both',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I can assign a 300x250 creative to matching placements. But I need more context — could you tell me which advertiser we\'re working with and which campaign? The creative and placements need to be in the same campaign.\n\nOnce I know those details, I\'ll pull up the 300x250 creative(s) and matching placements.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'which campaign', description: 'Asks for campaign' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-019',
    prompt: 'Make an ad for the ESPN placement',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Multiple advertisers have ESPN placements — asks which advertiser and which creative',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Several advertisers have placements on ESPN. To create an ad, I need to know which advertiser\'s ESPN placement you mean — multiple advertisers may have placements on ESPN. I also need to know which creative should be assigned.\n\nWhich advertiser are we talking about?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks which advertiser' },
      { type: 'contains', value: 'creative', description: 'Asks which creative' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-020',
    prompt: 'I need ads for the Q2 campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Multiple advertisers have Q2 campaigns — asks which advertiser and which creative assignments',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Several advertisers have Q2 campaigns. To create ads, I need to know which advertiser\'s Q2 campaign you\'re referring to, and which creatives should be assigned to which placements.\n\nIf you tell me the advertiser, I can list their Q2 campaign\'s placements and available creatives to help plan the assignments.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks which advertiser' },
      { type: 'contains', value: 'creative', description: 'Asks about creative assignments' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-021',
    prompt: 'Create an ad with the first creative',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: '"The first creative" is unresolvable without advertiser context — asks for advertiser, campaign, and placement',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'d need more context to know which "first creative" you mean. To create an ad, I need to know which advertiser (so I can look up their creatives), which campaign the ad goes into, and which placement to link the creative to.\n\nWhich advertiser should I start with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'placement', description: 'Asks for placement' },
      { type: 'not_contains', value: 'cm360_create_ad', description: 'Does NOT create without details' },
    ],
  },
];

// ---------------------------------------------------------------------------
// D. Ambiguous References (CQ-022 to CQ-028)
// ---------------------------------------------------------------------------

const ambiguousReferences: TestPrompt[] = [
  {
    id: 'CQ-022',
    prompt: 'Add a placement to that campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'No prior context — "that" is unresolvable. Asks which advertiser and campaign.',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'m not sure which campaign you\'re referring to — I don\'t have context from a previous conversation.\n\nCould you tell me:\n1. **Which advertiser** are we working with?\n2. **Which campaign** should the placement go in?\n\nI can list the advertisers and their campaigns if that helps.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which campaign', description: 'Asks to clarify "that campaign"' },
      { type: 'contains', value: 'advertiser', description: 'Asks for advertiser context' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without context' },
    ],
  },
  {
    id: 'CQ-023',
    prompt: 'Create something for the hotel company',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Resolves "hotel company" to Crestview Hotels, but "something" is vague — asks what to create',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I\'m guessing you mean **Crestview Hotels** (90005) — our hotel advertiser. But what would you like me to create?\n\n- **Campaign** — a new campaign with name and dates\n- **Placement** — an ad placement on a specific site\n- **Ad** — linking a creative to a placement\n- **Landing page** — a new landing page URL\n\nWhat are we building?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Crestview Hotels', description: 'Resolves hotel company' },
      { type: 'contains', value: 'what', description: 'Asks what to create' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create anything without details' },
    ],
  },
  {
    id: 'CQ-024',
    prompt: 'Use the standard size',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: '300x250 is the most common "standard" size but should confirm rather than assume',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'When you say "standard size," the most common display ad size is **300x250** (medium rectangle). But I want to make sure — did you mean:\n\n- **300x250** — medium rectangle (most common)\n- **728x90** — leaderboard\n- **160x600** — wide skyscraper\n\nAlso, I need more context — what are we creating? A placement? Which advertiser and campaign?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '300x250', description: 'Suggests 300x250 as standard' },
      { type: 'contains', value: 'did you mean', description: 'Asks for confirmation instead of assuming' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without confirmation' },
    ],
  },
  {
    id: 'CQ-025',
    prompt: 'Put it on the sports site',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'ESPN is the obvious sports site but should confirm, and "it" is unresolvable',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'m guessing "the sports site" is **ESPN** — that\'s the sports publisher in our account. But I want to confirm that.\n\nAlso, I need more context on what to put there:\n1. **Which advertiser and campaign** are we working with?\n2. **What ad size** should the placement be?\n\nCan you fill me in on the details?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ESPN', description: 'Identifies ESPN as sports site' },
      { type: 'contains', value: 'confirm', description: 'Asks for confirmation rather than assuming' },
      { type: 'contains', value: 'advertiser', description: 'Asks for missing advertiser context' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without confirmation' },
    ],
  },
  {
    id: 'CQ-026',
    prompt: 'The usual setup',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'Completely vague — no way to know what "usual" means. Asks for clarification.',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I don\'t have context on what your "usual setup" looks like — I don\'t have memory of previous sessions.\n\nCould you describe what you need? For example:\n- A new **campaign** with placements across specific sites?\n- A standard set of **placements** (e.g., 300x250 + 728x90 on a few publishers)?\n- **Ads** linking creatives to existing placements?\n\nWhich advertiser are we working with, and what should I set up?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'context', description: 'Explains lack of context' },
      { type: 'contains', value: 'describe', description: 'Asks user to describe what they need' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create anything' },
    ],
  },
  {
    id: 'CQ-027',
    prompt: 'Same as last time',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'No prior conversation context to reference — asks user to specify what they need',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I don\'t have memory of a previous conversation, so I\'m not sure what "last time" refers to.\n\nCould you tell me what you\'d like me to do? For example:\n- Which **advertiser** are we working with?\n- What needs to be created — a **campaign**, **placements**, **ads**?\n- Any specific **sites**, **sizes**, or **dates**?\n\nI\'m happy to help once I know the details!',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'don\'t have memory', description: 'Explains no prior context' },
      { type: 'contains', value: 'advertiser', description: 'Asks for basic details' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT fabricate actions' },
    ],
  },
  {
    id: 'CQ-028',
    prompt: 'Add more placements',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: '"More" implies existing context but there is none — asks for advertiser, campaign, sites, sizes, count',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'d love to help add placements! I need a few details:\n\n1. Could you tell me which advertiser and campaign we\'re adding placements to?\n2. **Which sites** should they go on?\n3. **What ad sizes** do you need?\n4. **How many** placements are you looking to add?\n\nWhich advertiser are we working with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'site', description: 'Asks which sites' },
      { type: 'contains', value: 'size', description: 'Asks what sizes' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
];

// ---------------------------------------------------------------------------
// E. Complex Multi-Entity Requests (CQ-029 to CQ-035)
// ---------------------------------------------------------------------------

const complexMultiEntity: TestPrompt[] = [
  {
    id: 'CQ-029',
    prompt: 'Set up everything for a new Harvest Organics campaign',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Resolves Harvest Organics, but "everything" is undefined — asks what specifically is needed',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Harvest' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Found **Harvest Organics** (90006). "Everything" can mean a lot in CM360! Let me break down what I can help with:\n\n1. **Campaign** — I\'ll need a name, start date, and end date\n2. **Placements** — which sites and ad sizes?\n3. **Ads** — which creatives to assign to placements?\n4. **Tags** — generate ad serving tags after placements are set up?\n\nLet\'s start with the campaign. What should we call it, and when does it run?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Harvest Organics', description: 'Resolves advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'contains', value: 'site', description: 'Asks about sites for placements' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-030',
    prompt: 'Traffic the Q2 buy for Luminance',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Resolves Luminance Beauty and Q2 campaign, asks what placements/sizes/sites to create',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Luminance' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001', searchString: 'Q2' } },
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Found **Luminance Beauty** (90001) and their **Q2 2026 Video Conversions** campaign.\n\nTo traffic the buy, I need to know what placements to create:\n\n1. **Which sites** should the placements go on?\n2. **What ad sizes?** — e.g., 300x250, 728x90, 970x250\n3. **How many placements** in total?\n\nDo you have an IO or media plan I can reference, or should we build it from scratch?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Luminance', description: 'Resolves Luminance Beauty' },
      { type: 'contains', value: 'Q2', description: 'Resolves Q2 campaign' },
      { type: 'contains', value: 'site', description: 'Asks which sites' },
      { type: 'contains', value: 'size', description: 'Asks what sizes' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-031',
    prompt: 'I need tags for the new campaign',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: '"The new campaign" is unresolvable — asks which advertiser and which campaign',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I can generate ad serving tags once I know which campaign. I need to know which advertiser we\'re working with and which campaign "the new campaign" refers to.\n\nTags are generated from placements, so the campaign will need existing placements. Want me to list advertisers and their campaigns?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'which campaign', description: 'Asks to identify the campaign' },
      { type: 'not_contains', value: 'cm360_generate_tags', description: 'Does NOT generate tags without context' },
    ],
  },
  {
    id: 'CQ-032',
    prompt: 'Create placements for all our sites',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: '"All sites" is ambitious — asks which advertiser, campaign, and what sizes per site',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'That would be placements across all 10 publisher sites — quite a few! I need to know which advertiser this is for, which campaign the placements should go in, and what ad size(s) — the same size on every site, or different sizes per site?\n\nFor reference, the available sites are: ESPN, CNN, Forbes, Bloomberg, NYTimes, WashPost, TheVerge, TechCrunch, Hulu, and Spotify.\n\nWhich advertiser and campaign?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'size', description: 'Asks about size strategy' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
  {
    id: 'CQ-033',
    prompt: 'Set up Meridian the same as Apex',
    category: 'clarifying-questions',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Resolves both advertisers but "the same" is vague — asks which specific aspects to replicate',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I found both **Meridian Financial** (90002) and **Apex Motors** (90000). Apex has 3 campaigns with placements across multiple sites.\n\n"The same" could mean a lot of things — I need to know which aspects you want to replicate:\n\n1. **Same campaign structure?** — Create matching campaigns (Q1/Q2/Q3) for Meridian?\n2. **Same placement mix?** — Mirror the sites and ad sizes Apex is using?\n3. **Same everything?** — Full replication of campaigns, placements, and ad assignments?\n\nWhich aspect should I match?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Meridian', description: 'Identifies Meridian Financial' },
      { type: 'contains', value: 'Apex', description: 'Identifies Apex Motors' },
      { type: 'contains', value: 'which', description: 'Asks which aspects to replicate' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without clarity' },
    ],
  },
  {
    id: 'CQ-034',
    prompt: 'Do the full setup',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'No context at all — asks for advertiser, what to set up, and specifics',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I\'m ready to help with a full setup! But I need to know what we\'re setting up:\n\n1. **Which advertiser** are we working with?\n2. **What should I create?**\n   - New campaign with name and dates?\n   - Placements on specific sites with specific sizes?\n   - Ads linking creatives to placements?\n   - Tags for trafficking?\n\nLet\'s start with the basics — which advertiser?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'what', description: 'Asks what to create' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without context' },
    ],
  },
  {
    id: 'CQ-035',
    prompt: 'Can you handle the ESPN buy?',
    category: 'clarifying-questions',
    expectedTools: [],
    expectedBehavior: 'ESPN is identified but everything else is missing — asks for advertiser, campaign, sizes, and dates',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Absolutely, I can help set up an ESPN buy! I need a few details — could you tell me which advertiser this ESPN buy is for, which campaign the placement(s) should go in (or do we need a new campaign), what ad sizes you need (e.g., 300x250, 728x90, 970x250), and what dates the buy runs?\n\nIf it\'s a new campaign, I\'ll need start and end dates. Which advertiser is buying on ESPN?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'which advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'campaign', description: 'Asks about campaign' },
      { type: 'contains', value: 'size', description: 'Asks about ad sizes' },
      { type: 'contains', value: 'date', description: 'Asks about dates' },
      { type: 'not_contains', value: 'cm360_create_placement', description: 'Does NOT create without details' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Export all clarifying-question prompts
// ---------------------------------------------------------------------------

export const CLARIFYING_QUESTION_PROMPTS: TestPrompt[] = [
  ...missingCampaignParams,
  ...missingPlacementParams,
  ...missingAdCreativeParams,
  ...ambiguousReferences,
  ...complexMultiEntity,
];
