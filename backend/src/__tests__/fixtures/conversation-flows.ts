/**
 * Multi-turn conversation flow scenarios.
 *
 * Each flow is a sequence of user messages with expected mock responses,
 * testing that the tool maintains context across turns.
 */

import type { MockResponse, ResponseAssertion } from './test-prompts.js';

export interface ConversationTurn {
  userMessage: string;
  mockResponses: MockResponse[];
  responseAssertions: ResponseAssertion[];
  description: string;
}

export interface ConversationFlow {
  id: string;
  name: string;
  description: string;
  turns: ConversationTurn[];
}

export const CONVERSATION_FLOWS: ConversationFlow[] = [
  // -----------------------------------------------------------------------
  // Flow 1: Browse → Drill down → Create
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-001',
    name: 'Browse to create workflow',
    description: 'User browses advertisers, drills into campaigns, then creates a placement',
    turns: [
      {
        userMessage: 'What advertisers do we have?',
        mockResponses: [
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
              { type: 'text', text: 'Here are the 7 advertisers:\n\n1. Apex Motors\n2. Luminance Beauty\n3. Meridian Financial\n4. NovaTech Solutions\n5. Vanguard Athletics\n6. Crestview Hotels\n7. Harvest Organics\n\nWhich one would you like to explore?' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Apex Motors', description: 'Lists advertisers' },
        ],
        description: 'Initial browse — list all advertisers',
      },
      {
        userMessage: 'Show me campaigns for the third one',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90002' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Here are the campaigns for **Meridian Financial** (90002):\n\n| Campaign | Dates |\n|---|---|\n| Meridian Q1 2026 Display | Jan-Mar |\n| Meridian Q2 2026 Video | Apr-Jun |\n| Meridian Q3 2026 Mobile | Jul-Sep |' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Meridian', description: 'Correctly resolves "the third one" to Meridian Financial' },
        ],
        description: 'Referential — "the third one" should resolve from previous context',
      },
      {
        userMessage: 'Add a 300x250 placement on CNN to the first campaign',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'CNN' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Here\'s what I\'d create:\n\n**Placement Preview:**\n- Campaign: Meridian Q1 2026 Display\n- Site: CNN.com\n- Size: 300x250\n- Dates: 2026-01-01 to 2026-03-31\n\nShall I create it?' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Meridian', description: 'Maintains context — correct advertiser' },
          { type: 'contains', value: 'CNN', description: 'Correct site' },
          { type: 'contains', value: '300x250', description: 'Correct size' },
        ],
        description: 'Creates placement in context — references "the first campaign" from previous turn',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow 2: Campaign creation with incremental info
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-002',
    name: 'Incremental campaign creation',
    description: 'User provides campaign details piece by piece across multiple turns',
    turns: [
      {
        userMessage: 'I need to create a new campaign',
        mockResponses: [
          {
            content: [
              { type: 'text', text: 'I\'d be happy to help create a campaign! I need a few details:\n\n1. **Which advertiser?**\n2. **Campaign name?**\n3. **Start and end dates?**\n\nWhich advertiser should this be for?' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'advertiser', description: 'Asks for required info' },
        ],
        description: 'Asks for missing info instead of guessing',
      },
      {
        userMessage: 'It\'s for Crestview Hotels',
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
              { type: 'text', text: 'Got it — **Crestview Hotels** (90005). Now I need:\n\n1. **Campaign name** — what should we call it?\n2. **Start and end dates** — when does it run?\n\nI\'ve already found their landing pages so we\'re ready to go once I have those details.' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Crestview Hotels', description: 'Confirms the advertiser' },
          { type: 'contains', value: 'name', description: 'Asks for remaining info' },
        ],
        description: 'Resolves advertiser, asks for remaining details',
      },
      {
        userMessage: 'Call it "Summer Beach Promo" running July through September',
        mockResponses: [
          {
            content: [
              { type: 'text', text: 'Here\'s the campaign I\'ll create:\n\n**Campaign Preview:**\n- **Advertiser:** Crestview Hotels (90005)\n- **Name:** Summer Beach Promo\n- **Start Date:** 2026-07-01\n- **End Date:** 2026-09-30\n- **Landing Page:** Crestview Hotels Homepage\n\nShall I go ahead and create it?' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Summer Beach Promo', description: 'Uses provided name' },
          { type: 'contains', value: '2026-07-01', description: 'Converts "July" to YYYY-MM-DD' },
          { type: 'contains', value: 'Crestview Hotels', description: 'Maintains advertiser context' },
        ],
        description: 'Shows preview with all details, converts natural language dates',
      },
      {
        userMessage: 'Yes, create it',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_4', name: 'cm360_create_campaign', input: {
                profileId: '12345',
                advertiserId: '90005',
                name: 'Summer Beach Promo',
                startDate: '2026-07-01',
                endDate: '2026-09-30',
                defaultLandingPageId: '90017',
              } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Done! **Summer Beach Promo** has been created for Crestview Hotels.\n\n- **Campaign ID:** 90180\n- **Dates:** 2026-07-01 to 2026-09-30\n\nWould you like to add placements to this campaign?' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'created', description: 'Confirms creation' },
          { type: 'contains', value: 'Summer Beach Promo', description: 'Uses correct name' },
        ],
        description: 'Creates after explicit confirmation',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow 3: Investigation workflow
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-003',
    name: 'Account investigation',
    description: 'User asks progressively deeper questions about account data',
    turns: [
      {
        userMessage: 'Show me all active campaigns',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_campaigns', input: { profileId: '12345' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Here are all 25 campaigns across the account. The first few:\n\n| # | Campaign | Advertiser | Dates |\n|---|---|---|---|\n| 1 | Apex Q1 Display Awareness | Apex Motors | Jan-Mar |\n| 2 | Apex Q2 Video Conversions | Apex Motors | Apr-Jun |\n| 3 | Luminance Q1 Display | Luminance Beauty | Jan-Mar |\n| ... | (22 more) |' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'campaign', description: 'Lists campaigns' },
        ],
        description: 'List all campaigns',
      },
      {
        userMessage: 'How many placements does the second one have?',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90025' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'The **Apex Q2 Video Conversions** campaign has 3 placements.' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Apex', description: 'Resolves "the second one" correctly' },
          { type: 'matches_pattern', value: '\\d+\\s*placement', description: 'Shows placement count' },
        ],
        description: 'Referential — "the second one" from the list',
      },
      {
        userMessage: 'Generate tags for that campaign',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90025' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_5', name: 'cm360_generate_tags', input: { profileId: '12345', campaignId: '90025', placementIds: ['90100', '90101', '90102'] } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Here are the ad serving tags for all 3 placements in the Apex Q2 Video Conversions campaign:\n\n**Placement 1:**\n```html\n<script src="https://ad.doubleclick.net/..."></script>\n```\n\n(plus 2 more)' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'tag', description: 'Generates tags' },
          { type: 'contains', value: 'Apex', description: 'Maintains campaign context' },
        ],
        description: 'Uses "that campaign" — referential to previous turn',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow 4: Error recovery
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-004',
    name: 'Error recovery',
    description: 'User makes a mistake, tool helps recover',
    turns: [
      {
        userMessage: 'Show me campaigns for Zenith Corp',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_advertisers', input: { profileId: '12345', searchString: 'Zenith' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'I couldn\'t find an advertiser called "Zenith Corp" in this account. Here are the available advertisers:\n\n1. Apex Motors\n2. Luminance Beauty\n3. Meridian Financial\n4. NovaTech Solutions\n5. Vanguard Athletics\n6. Crestview Hotels\n7. Harvest Organics\n\nDid you mean one of these?' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'couldn\'t find', description: 'Reports not found' },
          { type: 'contains', value: 'Apex Motors', description: 'Lists alternatives' },
        ],
        description: 'Handles nonexistent advertiser gracefully',
      },
      {
        userMessage: 'Oh sorry, I meant NovaTech',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90003' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'No problem! Here are the campaigns for **NovaTech Solutions**:\n\n| Campaign | Dates |\n|---|---|\n| NovaTech Q1 Display | Jan-Mar |\n| NovaTech Q2 Video | Apr-Jun |\n| NovaTech Q3 Mobile | Jul-Sep |' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'NovaTech', description: 'Recovers to correct advertiser' },
        ],
        description: 'Recovers from user correction — picks up context',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow 5: Tag generation pipeline
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-005',
    name: 'Full tag generation pipeline',
    description: 'User goes through full flow: pick advertiser → pick campaign → list placements → generate tags',
    turns: [
      {
        userMessage: 'I need to generate tags for Vanguard Athletics',
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
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Vanguard Athletics has 3 campaigns. Which one do you need tags for?\n\n1. Vanguard Q1 Display Awareness\n2. Vanguard Q2 Video Retargeting\n3. Vanguard Q3 Mobile Launch' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Vanguard', description: 'Identifies advertiser' },
          { type: 'contains', value: 'Which', description: 'Asks which campaign' },
        ],
        description: 'Identifies advertiser, asks which campaign',
      },
      {
        userMessage: 'The first one',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90036' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_5', name: 'cm360_generate_tags', input: { profileId: '12345', campaignId: '90036', placementIds: ['90120', '90121'] } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Here are the tags for the **Vanguard Q1 Display Awareness** campaign (2 placements):\n\n**Placement 1 — ESPN_Vanguard_300x250:**\n```\n<script src="https://ad.doubleclick.net/ddm/trackimp/..."></script>\n```\n\n**Placement 2 — CNN_Vanguard_728x90:**\n```\n<script src="https://ad.doubleclick.net/ddm/trackimp/..."></script>\n```' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Vanguard', description: 'Maintains advertiser context' },
          { type: 'contains', value: 'script', description: 'Includes actual tag code' },
        ],
        description: 'Generates tags for "the first one" — referential',
      },
    ],
  },

  // -----------------------------------------------------------------------
  // Flow 6: Cross-advertiser comparison
  // -----------------------------------------------------------------------
  {
    id: 'FLOW-006',
    name: 'Cross-advertiser comparison',
    description: 'User compares data across advertisers in multiple turns',
    turns: [
      {
        userMessage: 'How many campaigns does Apex Motors have?',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'tool_use', id: 'tu_2', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Apex Motors has 4 campaigns.' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Apex', description: 'Names the advertiser' },
        ],
        description: 'First advertiser query',
      },
      {
        userMessage: 'What about Luminance Beauty?',
        mockResponses: [
          {
            content: [
              { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
            ],
            stop_reason: 'tool_use',
          },
          {
            content: [
              { type: 'text', text: 'Luminance Beauty has 3 campaigns.\n\nSo Apex Motors (4) has one more campaign than Luminance Beauty (3).' },
            ],
            stop_reason: 'end_turn',
          },
        ],
        responseAssertions: [
          { type: 'contains', value: 'Luminance', description: 'Answers for the new advertiser' },
        ],
        description: '"What about X?" — implicit comparison, same question for different entity',
      },
    ],
  },
];
