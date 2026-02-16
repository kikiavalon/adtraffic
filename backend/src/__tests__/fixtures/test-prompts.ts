/**
 * Realistic test prompts organized by category.
 *
 * Each prompt defines:
 * - prompt: What the user would type
 * - category: Grouping for reporting
 * - expectedTools: Which CM360 tool(s) Claude should call
 * - expectedBehavior: What a correct response looks like
 * - mockToolSequence: The mocked Claude API responses (tool_use → text)
 *
 * Mock data reference (seeded from mock-data-store.ts):
 *   Profile ID: 12345 | Account: 67890 (Demo Agency)
 *   Advertisers: 90000-90006 (Apex Motors, Luminance Beauty, Meridian Financial, NovaTech Solutions, Vanguard Athletics, Crestview Hotels, Harvest Organics)
 *   Sites: 90007-90016 (ESPN, CNN, Forbes, Bloomberg, NYTimes, WashPost, TheVerge, TechCrunch, Hulu, Spotify)
 *   Campaigns: starts at 90024 (seeded ~25, 3-4 per advertiser)
 *   Placements: starts after campaigns (~80 total)
 */

export interface TestPrompt {
  id: string;
  prompt: string;
  category: TestCategory;
  expectedTools: string[];
  expectedBehavior: string;
  mockToolSequence: MockResponse[];
  responseAssertions: ResponseAssertion[];
}

export type TestCategory =
  | 'campaign-management'
  | 'ad-placement-ops'
  | 'reporting'
  | 'conversion-tracking'
  | 'edge-case'
  | 'ambiguous'
  | 'adversarial'
  | 'out-of-scope'
  | 'multi-step';

export interface MockResponse {
  content: MockContentBlock[];
  stop_reason: 'end_turn' | 'tool_use';
}

export interface MockContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface ResponseAssertion {
  type: 'contains' | 'not_contains' | 'matches_pattern';
  value: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Category 1: Campaign Management (8 prompts)
// ---------------------------------------------------------------------------

const campaignManagement: TestPrompt[] = [
  {
    id: 'CM-001',
    prompt: 'What advertisers do we have?',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Lists all 7 advertisers with names and IDs',
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
          { type: 'text', text: 'Here are the 7 advertisers in the Demo Agency account:\n\n| Advertiser | ID |\n|---|---|\n| Apex Motors | 90000 |\n| Luminance Beauty | 90001 |\n| Meridian Financial | 90002 |\n| NovaTech Solutions | 90003 |\n| Vanguard Athletics | 90004 |\n| Crestview Hotels | 90005 |\n| Harvest Organics | 90006 |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex Motors', description: 'Lists first advertiser' },
      { type: 'contains', value: 'Harvest Organics', description: 'Lists last advertiser' },
    ],
  },
  {
    id: 'CM-002',
    prompt: 'Show me campaigns for Apex Motors',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Finds Apex Motors by name, then lists its campaigns',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are the campaigns for **Apex Motors** (ID: 90000):\n\n| Campaign | Start | End |\n|---|---|---|\n| Apex Q1 2026 Display Awareness | 2026-01-01 | 2026-03-31 |\n| Apex Q2 2026 Video Conversions | 2026-04-01 | 2026-06-30 |\n| Apex Q3 2026 Mobile Retargeting | 2026-07-01 | 2026-09-30 |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex', description: 'References Apex Motors' },
      { type: 'contains', value: 'Q1', description: 'Shows Q1 campaign' },
    ],
  },
  {
    id: 'CM-003',
    prompt: 'Create a new Q3 campaign for Luminance Beauty',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Gathers info, shows preview, asks for confirmation before creating',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'I\'d like to create the following campaign:\n\n**Campaign Preview:**\n- **Advertiser:** Luminance Beauty (90001)\n- **Name:** Luminance Beauty Q3 2026\n- **Start Date:** 2026-07-01\n- **End Date:** 2026-09-30\n- **Landing Page:** Luminance Beauty Homepage\n\nShall I go ahead and create this?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Luminance Beauty', description: 'Names the advertiser' },
      { type: 'contains', value: 'Shall I go ahead', description: 'Asks for confirmation' },
      { type: 'not_contains', value: 'cm360_create_campaign', description: 'Does NOT create without confirmation' },
    ],
  },
  {
    id: 'CM-004',
    prompt: 'List all active campaigns across all advertisers',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_campaigns'],
    expectedBehavior: 'Returns all ~25 campaigns in a table',
    mockToolSequence: [
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
          { type: 'text', text: 'Here are all campaigns across all advertisers. The account has 25 active campaigns spanning Q1-Q4 2026.\n\n| Campaign | Advertiser | Dates |\n|---|---|---|\n| (table of campaigns) |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'campaign', description: 'Mentions campaigns' },
    ],
  },
  {
    id: 'CM-005',
    prompt: 'How many campaigns does NovaTech Solutions have?',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Looks up NovaTech, counts campaigns, returns a number',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90003' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'NovaTech Solutions has 3 campaigns.' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'NovaTech', description: 'Names the advertiser' },
      { type: 'matches_pattern', value: '\\d+\\s*campaign', description: 'Includes a count' },
    ],
  },
  {
    id: 'CM-006',
    prompt: 'Find campaigns with "Q1" in the name',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_campaigns'],
    expectedBehavior: 'Searches campaigns by name containing Q1',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_campaigns', input: { profileId: '12345', searchString: 'Q1' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'I found 7 campaigns with "Q1" in the name:\n\n| Campaign | Advertiser | Dates |\n|---|---|---|' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Q1', description: 'References Q1 in results' },
    ],
  },
  {
    id: 'CM-007',
    prompt: 'Show me the details for advertiser 90002',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_get_advertiser'],
    expectedBehavior: 'Fetches Meridian Financial by ID',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_get_advertiser', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are the details for **Meridian Financial** (ID: 90002):\n- Status: APPROVED\n- Account: Demo Agency (67890)' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Meridian Financial', description: 'Names the advertiser' },
      { type: 'contains', value: 'APPROVED', description: 'Shows status' },
    ],
  },
  {
    id: 'CM-008',
    prompt: 'What landing pages does Crestview Hotels have?',
    category: 'campaign-management',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Looks up Crestview Hotels, lists its landing pages',
    mockToolSequence: [
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
          { type: 'text', text: 'Crestview Hotels has the following landing pages:\n\n| Name | URL |\n|---|---|\n| Crestview Hotels Homepage | https://www.crestviewhotels.com |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Crestview', description: 'References the advertiser' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Category 2: Ad & Placement Operations (8 prompts)
// ---------------------------------------------------------------------------

const adPlacementOps: TestPrompt[] = [
  {
    id: 'AP-001',
    prompt: 'Show me all placements for the first Apex Motors campaign',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Resolves Apex Motors → first campaign → lists placements',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90024' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are the placements for the first Apex Motors campaign:\n\n| Placement | Site | Size | Status |\n|---|---|---|---|' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'placement', description: 'Discusses placements' },
    ],
  },
  {
    id: 'AP-002',
    prompt: 'What sites are available for placing ads?',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_sites'],
    expectedBehavior: 'Lists all 10 publisher sites',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_sites', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are the 10 available publisher sites:\n\nESPN.com, CNN.com, Forbes.com, Bloomberg.com, NYTimes.com, WashingtonPost.com, TheVerge.com, TechCrunch.com, Hulu.com, Spotify.com' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ESPN', description: 'Lists ESPN' },
      { type: 'contains', value: 'Spotify', description: 'Lists Spotify' },
    ],
  },
  {
    id: 'AP-003',
    prompt: 'Generate tags for all placements in the first Apex Motors campaign',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_generate_tags'],
    expectedBehavior: 'Resolves campaign, gets placements, generates tags',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90024' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'I found 3 placements. Here are the generated ad serving tags:\n\n**Placement 1** — ESPN_Apex_300x250\n```html\n<script src="https://ad.doubleclick.net/..."></script>\n```' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'tag', description: 'Mentions tags' },
    ],
  },
  {
    id: 'AP-004',
    prompt: 'Show me the creatives for Luminance Beauty',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_creatives'],
    expectedBehavior: 'Resolves advertiser, lists its 2 creatives',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Luminance Beauty has 2 creatives:\n\n| Creative | Size | Type |\n|---|---|---|\n| Luminance_300x250_v1 | 300x250 | Display Image Gallery |\n| Luminance_728x90_v2 | 728x90 | Display Image Gallery |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Luminance', description: 'References the advertiser' },
      { type: 'contains', value: 'creative', description: 'Discusses creatives' },
    ],
  },
  {
    id: 'AP-005',
    prompt: 'Create a 300x250 placement on ESPN for the first Apex Motors campaign',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_sites'],
    expectedBehavior: 'Gathers info, shows preview with all details, asks for confirmation',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'ESPN' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here\'s the placement I\'d like to create:\n\n**Placement Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Site:** ESPN.com\n- **Size:** 300x250\n- **Dates:** 2026-01-01 to 2026-03-31\n\nShall I create it?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ESPN', description: 'References ESPN' },
      { type: 'contains', value: '300x250', description: 'Shows correct size' },
      { type: 'contains', value: 'Shall I create', description: 'Asks for confirmation' },
    ],
  },
  {
    id: 'AP-006',
    prompt: 'Show me ads for Vanguard Athletics',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_ads'],
    expectedBehavior: 'Resolves advertiser, lists ads',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_ads', input: { profileId: '12345', advertiserId: '90004' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Vanguard Athletics has the following ads:\n\n| Ad Name | Campaign | Active |\n|---|---|---|' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Vanguard', description: 'Names the advertiser' },
    ],
  },
  {
    id: 'AP-007',
    prompt: 'Create a landing page for Harvest Organics called "Fall Harvest" with URL https://www.harvestorganics.com/fall',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Shows preview of landing page, asks for confirmation before creating',
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
          { type: 'text', text: 'Here\'s the landing page I\'d create:\n\n**Landing Page Preview:**\n- **Advertiser:** Harvest Organics (90006)\n- **Name:** Fall Harvest\n- **URL:** https://www.harvestorganics.com/fall\n\nShall I go ahead?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Harvest Organics', description: 'Names the advertiser' },
      { type: 'contains', value: 'Fall Harvest', description: 'Uses the provided name' },
      { type: 'contains', value: 'harvestorganics.com/fall', description: 'Uses the provided URL' },
    ],
  },
  {
    id: 'AP-008',
    prompt: 'Are there any placements on TechCrunch?',
    category: 'ad-placement-ops',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Searches placements filtered by TechCrunch site',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_placements', input: { profileId: '12345', searchString: 'TechCrunch' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Yes, there are several placements on TechCrunch across different campaigns.' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'TechCrunch', description: 'References the site' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Category 3: Reporting Requests (6 prompts)
// ---------------------------------------------------------------------------

const reportingRequests: TestPrompt[] = [
  {
    id: 'RP-001',
    prompt: 'How many placements does each advertiser have?',
    category: 'reporting',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_placements'],
    expectedBehavior: 'Lists all advertisers, counts placements per advertiser',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_placements', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here\'s the placement count per advertiser:\n\n| Advertiser | Placements |\n|---|---|\n| Apex Motors | 12 |\n| Luminance Beauty | 11 |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex', description: 'Lists advertisers' },
      { type: 'matches_pattern', value: '\\d+', description: 'Includes counts' },
    ],
  },
  {
    id: 'RP-002',
    prompt: 'Give me a summary of the Meridian Financial account',
    category: 'reporting',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_creatives'],
    expectedBehavior: 'Provides campaign count, placement count, creative count',
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
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90002' } },
          { type: 'tool_use', id: 'tu_5', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: '**Meridian Financial — Account Summary**\n- Campaigns: 3\n- Placements: 9\n- Creatives: 2\n- Status: APPROVED' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Meridian', description: 'Names the advertiser' },
      { type: 'contains', value: 'Campaign', description: 'Reports campaign info' },
    ],
  },
  {
    id: 'RP-003',
    prompt: 'Which campaigns are running in Q1 2026?',
    category: 'reporting',
    expectedTools: ['cm360_list_profiles', 'cm360_list_campaigns'],
    expectedBehavior: 'Lists campaigns with Q1 dates or searches by Q1',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_campaigns', input: { profileId: '12345', searchString: 'Q1' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are the Q1 2026 campaigns (January–March):\n\n| Campaign | Advertiser | Start | End |\n|---|---|---|---|' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Q1', description: 'References Q1' },
    ],
  },
  {
    id: 'RP-004',
    prompt: 'Show me all 728x90 placements',
    category: 'reporting',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Lists placements filtered by size 728x90',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_placements', input: { profileId: '12345', searchString: '728x90' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are all 728x90 (leaderboard) placements across the account:\n\n| Placement | Campaign | Site | Status |\n|---|---|---|---|' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '728x90', description: 'References the size' },
    ],
  },
  {
    id: 'RP-005',
    prompt: 'Compare placement counts between Apex Motors and Luminance Beauty',
    category: 'reporting',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Fetches placements for both, compares counts',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here\'s the comparison:\n\n| Advertiser | Placements |\n|---|---|\n| Apex Motors | 12 |\n| Luminance Beauty | 11 |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex', description: 'Mentions Apex' },
      { type: 'contains', value: 'Luminance', description: 'Mentions Luminance' },
    ],
  },
  {
    id: 'RP-006',
    prompt: 'What ad sizes are we using the most?',
    category: 'reporting',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Fetches all placements, aggregates by size, ranks',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_placements', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Based on all placements in the account, here are the most-used ad sizes:\n\n| Size | Count |\n|---|---|\n| 300x250 | 18 |\n| 728x90 | 15 |' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '300x250', description: 'Lists a common size' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Category 4: Ambiguous / Incomplete Requests (6 prompts)
// ---------------------------------------------------------------------------

const ambiguousRequests: TestPrompt[] = [
  {
    id: 'AM-001',
    prompt: 'Create a campaign',
    category: 'ambiguous',
    expectedTools: [],
    expectedBehavior: 'Asks which advertiser, campaign name, dates — does NOT immediately create',
    mockToolSequence: [
      {
        content: [
          { type: 'text', text: 'I\'d be happy to help create a campaign! I need a few details:\n\n1. **Which advertiser** should this campaign be for?\n2. **Campaign name** — what should we call it?\n3. **Start and end dates** — when does it run?\n\nWant me to list the available advertisers first?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Asks for advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'contains', value: 'date', description: 'Asks for dates' },
    ],
  },
  {
    id: 'AM-002',
    prompt: 'Show me how things are going',
    category: 'ambiguous',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Interprets vaguely as account overview, provides summary or asks for clarification',
    mockToolSequence: [
      {
        content: [
          { type: 'text', text: 'I can give you an overview of the account! Would you like:\n\n1. **Account summary** — advertiser count, campaign count, placement count\n2. **Active campaigns** — what\'s currently running\n3. **Specific advertiser** — deep dive into one brand\n\nWhat sounds most useful?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'error', description: 'No error message' },
    ],
  },
  {
    id: 'AM-003',
    prompt: 'Add a placement',
    category: 'ambiguous',
    expectedTools: [],
    expectedBehavior: 'Asks for campaign, site, size, dates — does NOT create without details',
    mockToolSequence: [
      {
        content: [
          { type: 'text', text: 'Sure! To create a placement I\'ll need:\n\n1. **Which campaign** should it go in?\n2. **Which site** (publisher) — e.g., ESPN, CNN, Forbes?\n3. **Ad size** — e.g., 300x250, 728x90\n4. **Start and end dates**\n\nWhich advertiser/campaign are we working with?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'campaign', description: 'Asks for campaign' },
      { type: 'contains', value: 'site', description: 'Asks for site' },
      { type: 'contains', value: 'size', description: 'Asks for size' },
    ],
  },
  {
    id: 'AM-004',
    prompt: 'What do we have for the car company?',
    category: 'ambiguous',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Searches for automotive advertiser (Apex Motors), asks for clarification if unsure',
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
          { type: 'text', text: 'I think you\'re referring to **Apex Motors** — that\'s our automotive advertiser. Would you like to see their campaigns, placements, or something else?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex Motors', description: 'Identifies the automotive brand' },
    ],
  },
  {
    id: 'AM-005',
    prompt: 'Traffic it',
    category: 'ambiguous',
    expectedTools: [],
    expectedBehavior: 'Asks what the user wants to traffic — no context to work from',
    mockToolSequence: [
      {
        content: [
          { type: 'text', text: 'I\'d love to help! Could you give me a bit more context? For example:\n\n- **Which advertiser and campaign** are we working with?\n- **What needs to be created** — placements, ads, tags?\n\nOr if you have an IO document, you can upload it and I\'ll extract the details.' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'context', description: 'Asks for clarification' },
    ],
  },
  {
    id: 'AM-006',
    prompt: 'Run the report',
    category: 'ambiguous',
    expectedTools: [],
    expectedBehavior: 'Clarifies that reporting isn\'t available yet, or asks which report',
    mockToolSequence: [
      {
        content: [
          { type: 'text', text: 'I don\'t currently have reporting tools available. I can help with:\n\n- **Listing** campaigns, placements, ads, and creatives\n- **Creating** campaigns, placements, landing pages, and ads\n- **Generating** ad serving tags\n\nCould you tell me more about what data you\'re looking for? I might be able to pull it from the account listings.' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'report generated', description: 'Doesn\'t fabricate a report' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Category 5: Multi-step operations (6 prompts)
// ---------------------------------------------------------------------------

const multiStepOps: TestPrompt[] = [
  {
    id: 'MS-001',
    prompt: 'Set up a full trafficking workflow for Meridian Financial: new campaign, placement on Forbes, and generate tags',
    category: 'multi-step',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages', 'cm360_list_sites'],
    expectedBehavior: 'Breaks down into steps, gathers info first, shows preview for each write op',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90002' } },
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'Forbes' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Great, I\'ll set this up step by step. Here\'s the plan:\n\n**Step 1 — New Campaign:**\n- Advertiser: Meridian Financial\n- I need a campaign name and dates. What should we call it and when does it run?\n\n**Step 2 — Placement on Forbes** (after campaign is created)\n\n**Step 3 — Generate tags** (after placement is created)\n\nLet\'s start with the campaign details. What name and dates?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Step', description: 'Breaks into steps' },
      { type: 'contains', value: 'Meridian', description: 'References the advertiser' },
      { type: 'contains', value: 'Forbes', description: 'References the site' },
    ],
  },
  {
    id: 'MS-002',
    prompt: 'I need to add 3 placements to the first NovaTech campaign: one on CNN (300x250), one on Bloomberg (728x90), and one on Forbes (970x250)',
    category: 'multi-step',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_sites'],
    expectedBehavior: 'Gathers all info, shows a combined preview of 3 placements, asks for confirmation',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90003' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here are the 3 placements I\'d create:\n\n| # | Site | Size | Campaign |\n|---|---|---|---|\n| 1 | CNN.com | 300x250 | NovaTech Q1 2026 |\n| 2 | Bloomberg.com | 728x90 | NovaTech Q1 2026 |\n| 3 | Forbes.com | 970x250 | NovaTech Q1 2026 |\n\nShall I create all 3?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'CNN', description: 'Lists CNN placement' },
      { type: 'contains', value: 'Bloomberg', description: 'Lists Bloomberg placement' },
      { type: 'contains', value: 'Forbes', description: 'Lists Forbes placement' },
      { type: 'contains', value: '300x250', description: 'Correct size for CNN' },
    ],
  },
  {
    id: 'MS-003',
    prompt: 'Create an ad for Apex Motors linking the first creative to the first placement in their Q1 campaign',
    category: 'multi-step',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_creatives'],
    expectedBehavior: 'Resolves all IDs through chained lookups, shows preview',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_5', name: 'cm360_list_placements', input: { profileId: '12345', campaignId: '90024' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Here\'s the ad I\'d create:\n\n**Ad Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Creative:** Apex_300x250_v1\n- **Placement:** ESPN_Apex_300x250\n\nShall I create it?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex', description: 'References Apex Motors' },
      { type: 'contains', value: 'Creative', description: 'Mentions the creative' },
      { type: 'contains', value: 'Placement', description: 'Mentions the placement' },
    ],
  },
  {
    id: 'MS-004',
    prompt: 'Walk me through everything in the Harvest Organics account',
    category: 'multi-step',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_creatives', 'cm360_list_ads'],
    expectedBehavior: 'Does multiple lookups, presents comprehensive account overview',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90006' } },
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90006' } },
          { type: 'tool_use', id: 'tu_5', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90006' } },
          { type: 'tool_use', id: 'tu_6', name: 'cm360_list_ads', input: { profileId: '12345', advertiserId: '90006' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: '**Harvest Organics — Full Account Overview**\n\n**Campaigns:** 3 active\n**Placements:** 8 across all campaigns\n**Creatives:** 2\n**Ads:** 3\n\nWant me to drill into any of these?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Harvest', description: 'References the advertiser' },
      { type: 'contains', value: 'Campaign', description: 'Shows campaign info' },
    ],
  },
  {
    id: 'MS-005',
    prompt: 'Find all advertisers with video placements',
    category: 'multi-step',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_placements'],
    expectedBehavior: 'Fetches all placements, identifies video-compatible ones, maps to advertisers',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_placements', input: { profileId: '12345' } },
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_advertisers', input: { profileId: '12345' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'text', text: 'Looking through all placements, I don\'t see any specifically flagged as IN_STREAM_VIDEO. All current placements are DISPLAY type. Would you like me to create a video placement for a specific campaign?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'not_contains', value: 'error', description: 'No error — handles gracefully' },
    ],
  },
  {
    id: 'MS-006',
    prompt: 'Create a new advertiser called "Zenith Electronics"',
    category: 'multi-step',
    expectedTools: [],
    expectedBehavior: 'Explains that creating advertisers is not available — only list/get',
    mockToolSequence: [
      {
        content: [
          { type: 'text', text: 'I\'m not able to create new advertisers through my current tools. Advertisers need to be created directly in the CM360 interface by an account admin.\n\nI can help with operations for existing advertisers — like creating campaigns, placements, ads, and generating tags. Would you like to work with one of the existing advertisers?' },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'not', description: 'Explains limitation' },
      { type: 'not_contains', value: 'Zenith Electronics has been created', description: 'Does NOT fabricate success' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Export all standard prompts
// ---------------------------------------------------------------------------

export const STANDARD_TEST_PROMPTS: TestPrompt[] = [
  ...campaignManagement,
  ...adPlacementOps,
  ...reportingRequests,
  ...ambiguousRequests,
  ...multiStepOps,
];
