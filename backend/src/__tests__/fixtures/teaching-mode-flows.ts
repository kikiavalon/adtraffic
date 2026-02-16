/**
 * Teaching-mode multi-turn conversation flows (4 flows, 12 turns total).
 *
 * These test that Kiki can maintain context across turns while teaching
 * CM360 concepts, seamlessly switch between teaching and task execution,
 * progressively deepen explanations, and correct misconceptions.
 *
 * Mock data reference (seeded from mock-data-store.ts):
 *   Profile ID: 12345 | Account: 67890 (Demo Agency)
 *   Advertisers: 90000 Apex Motors, 90001 Luminance Beauty,
 *                90002 Meridian Financial, 90003 NovaTech Solutions,
 *                90004 Vanguard Athletics, 90005 Crestview Hotels,
 *                90006 Harvest Organics
 *   Sites: ESPN, CNN, Forbes, Bloomberg, NYTimes, WashPost,
 *          TheVerge, TechCrunch, Hulu, Spotify
 */

import type { ConversationFlow } from './conversation-flows.js';

// ---------------------------------------------------------------------------
// FLOW-TM-001: Learning the hierarchy
// User asks about campaigns, then placements, then asks to see a real example
// ---------------------------------------------------------------------------

const learningHierarchy: ConversationFlow = {
  id: 'FLOW-TM-001',
  name: 'Learning the hierarchy',
  description:
    'User progressively learns the CM360 entity hierarchy: campaign concept, placement relationship, then real account data',
  turns: [
    {
      userMessage: "What's a campaign in CM360?",
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'A **campaign** in CM360 is the top-level container for an advertising initiative. Think of it as a folder that holds everything related to a specific effort.\n\nEvery campaign has:\n- **Advertiser** — the brand it belongs to (e.g., Apex Motors)\n- **Name** — a descriptive label (e.g., "Apex Q1 2026 Display Awareness")\n- **Start and end dates** — when the campaign runs\n- **Default landing page** — where clicks go by default\n\nUnder a campaign, you\'ll find **placements** (ad slots on publisher sites), **ads** (links between creatives and placements), and ultimately the **tags** that get sent to publishers.\n\nWould you like me to explain how placements fit into campaigns?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'campaign',
          description: 'Defines campaign concept',
        },
        {
          type: 'contains',
          value: 'container',
          description: 'Uses container metaphor',
        },
        {
          type: 'contains',
          value: 'placement',
          description: 'Previews the next concept',
        },
      ],
      description:
        'Turn 1: Explains the campaign concept at a beginner level',
    },
    {
      userMessage: 'How do placements fit in?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Placements are the **children** of a campaign. Each placement represents a specific ad slot on a specific publisher\'s site.\n\nHere\'s the hierarchy:\n```\nCampaign (e.g., "Apex Q1 2026 Display Awareness")\n  ├── Placement (ESPN, 300x250)\n  ├── Placement (CNN, 728x90)\n  └── Placement (Forbes, 300x600)\n```\n\nEach placement specifies:\n- **Which site** — the publisher (ESPN, CNN, Forbes)\n- **What size** — the ad dimensions (300x250, 728x90)\n- **When** — date range (must be within the campaign dates)\n\nA placement belongs to exactly one campaign. If you need the same site/size combo in another campaign, you create a new placement.\n\nWant me to show you a real campaign and its placements from our account?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'children',
          description: 'Explains parent-child relationship',
        },
        {
          type: 'contains',
          value: 'site',
          description: 'Explains placement components',
        },
        {
          type: 'contains',
          value: 'size',
          description: 'Mentions size as placement attribute',
        },
      ],
      description:
        'Turn 2: Explains placements as children of campaigns, maintains teaching context',
    },
    {
      userMessage: 'Yes, show me a real one from our account!',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'cm360_list_profiles',
              input: {},
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_2',
              name: 'cm360_list_advertisers',
              input: { profileId: '12345', searchString: 'Apex' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_3',
              name: 'cm360_list_campaigns',
              input: { profileId: '12345', advertiserId: '90000' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_4',
              name: 'cm360_list_placements',
              input: { profileId: '12345', campaignId: '90024' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s a real example from our account:\n\n**Campaign:** Apex Q1 2026 Display Awareness\n- Advertiser: Apex Motors\n- Dates: 2026-01-01 to 2026-03-31\n\n**Its placements:**\n| Placement | Site | Size |\n|---|---|---|\n| ESPN_Apex_300x250_0126_Display | ESPN | 300x250 |\n| CNN_Apex_728x90_0126_Display | CNN | 728x90 |\n| Forbes_Apex_300x600_0126_Display | Forbes | 300x600 |\n\nSee how the campaign is the container, and each placement is a specific slot? The naming convention (`Site_Advertiser_Size_MonthYear_Type`) makes it easy to identify what each placement is at a glance.\n\nThis is exactly the hierarchy we talked about — campaign at the top, placements underneath, each one tied to a specific site and size.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Apex',
          description: 'Shows real advertiser data',
        },
        {
          type: 'contains',
          value: 'ESPN',
          description: 'Shows real placement data',
        },
        {
          type: 'contains',
          value: 'hierarchy',
          description: 'Ties back to the teaching from earlier turns',
        },
      ],
      description:
        'Turn 3: Fetches real data and connects it to the concepts taught in previous turns',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-TM-002: Teaching mid-task
// User starts a task, realizes they don't understand the concept, learns, then continues
// ---------------------------------------------------------------------------

const teachingMidTask: ConversationFlow = {
  id: 'FLOW-TM-002',
  name: 'Teaching mid-task',
  description:
    'User starts a placement creation task, pauses to learn what a placement is, then resumes with details',
  turns: [
    {
      userMessage: 'I need to create a placement for Apex Motors',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'I\'d be happy to create a placement for Apex Motors! I need a few details:\n\n1. **Which campaign** should the placement go in? (Apex has Q1 Display, Q2 Video, and Q3 Mobile campaigns)\n2. **Which site** — e.g., ESPN, CNN, Forbes?\n3. **What size** — e.g., 300x250, 728x90?\n\nWant me to list their campaigns so you can pick one?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'campaign',
          description: 'Asks which campaign',
        },
        {
          type: 'contains',
          value: 'site',
          description: 'Asks which site',
        },
        {
          type: 'contains',
          value: 'size',
          description: 'Asks what size',
        },
      ],
      description:
        'Turn 1: Starts task, asks for required details',
    },
    {
      userMessage: "Wait, what even is a placement? I'm new to this.",
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'No problem at all — let me explain!\n\nA **placement** is a specific ad slot on a publisher\'s website. When Apex Motors wants a banner ad on ESPN\'s homepage, that "spot" for the banner is the placement.\n\nEvery placement has:\n- **Campaign** — the parent initiative it belongs to\n- **Site** — the publisher (ESPN, CNN, Forbes, etc.)\n- **Size** — the ad dimensions (e.g., 300x250 is the most common — a medium rectangle)\n- **Dates** — when the ad slot is active\n\nSo when I asked for a campaign, site, and size — those are the three things I need to define the placement. Think of it like booking a billboard: you need to know *which highway* (site), *what size board* (ad size), and *which campaign it\'s for*.\n\nNow that you know what a placement is — do you want to continue creating one for Apex Motors? Just tell me the site and size you\'d like!',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'placement',
          description: 'Teaches the concept',
        },
        {
          type: 'contains',
          value: 'site',
          description: 'Explains site component',
        },
        {
          type: 'contains',
          value: 'Apex Motors',
          description: 'Ties back to the original task',
        },
      ],
      description:
        'Turn 2: Pauses task to teach, then offers to resume',
    },
    {
      userMessage: 'Got it! Put it on ESPN, 300x250, for the Q1 campaign',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'cm360_list_profiles',
              input: {},
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_2',
              name: 'cm360_list_advertisers',
              input: { profileId: '12345', searchString: 'Apex' },
            },
            {
              type: 'tool_use',
              id: 'tu_3',
              name: 'cm360_list_sites',
              input: { profileId: '12345', searchString: 'ESPN' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_4',
              name: 'cm360_list_campaigns',
              input: { profileId: '12345', advertiserId: '90000' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the placement I\'d create:\n\n**Placement Preview:**\n- **Campaign:** Apex Q1 2026 Display Awareness\n- **Site:** ESPN.com\n- **Size:** 300x250 (Medium Rectangle)\n- **Name:** ESPN_Apex_300x250_0126_Display\n- **Dates:** 2026-01-01 to 2026-03-31 (matching the campaign)\n\nRemember how we talked about placements being an ad slot on a specific site? This is exactly that — a 300x250 spot on ESPN for the Apex Motors Q1 campaign.\n\nShall I create it?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'ESPN',
          description: 'Correct site',
        },
        {
          type: 'contains',
          value: '300x250',
          description: 'Correct size',
        },
        {
          type: 'contains',
          value: 'Q1',
          description: 'Correct campaign',
        },
        {
          type: 'contains',
          value: 'Shall I create',
          description: 'Asks for confirmation',
        },
      ],
      description:
        'Turn 3: Resumes task with provided details, shows preview, ties back to teaching',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-TM-003: Progressive depth on tags
// User asks about tags, then wants technical details, then asks to see a real one
// ---------------------------------------------------------------------------

const progressiveTagDepth: ConversationFlow = {
  id: 'FLOW-TM-003',
  name: 'Progressive depth on tags',
  description:
    'User starts with a basic tag question, asks for deeper technical detail, then requests a real tag example',
  turns: [
    {
      userMessage: 'What are tags?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'In CM360, **tags** (or "ad serving tags") are small code snippets that tell a publisher\'s website how to display your ad.\n\nHere\'s the simple version:\n1. You set up a campaign and placements in CM360\n2. CM360 generates a unique tag for each placement\n3. You send the tag to the publisher\n4. The publisher puts it on their website\n5. When someone visits the page, the tag loads your ad from CM360\'s servers\n\nTags are the bridge between your CM360 setup and the publisher\'s website. Without them, the publisher has no way to show your ads.\n\nWant to know more about how they work technically, or would you like to see a real one?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'tag',
          description: 'Explains tags at a high level',
        },
        {
          type: 'contains',
          value: 'publisher',
          description: 'Mentions publisher role',
        },
        {
          type: 'contains',
          value: 'placement',
          description: 'Connects tags to placements',
        },
      ],
      description: 'Turn 1: Brief, beginner-friendly explanation of tags',
    },
    {
      userMessage: 'How do they work technically?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s the technical flow when an ad tag fires:\n\n**1. Page loads** — A user visits a publisher\'s page that has your tag embedded in it.\n\n**2. Tag executes** — The JavaScript tag makes an HTTP request to CM360\'s ad servers (`ad.doubleclick.net`). The request includes the placement ID and other metadata.\n\n**3. CM360 decides what to serve** — The ad server checks:\n   - Is the placement active (within date range)?\n   - Which ad is assigned to this placement?\n   - Which creative should render?\n   - Are there any frequency caps or targeting rules?\n\n**4. Creative is returned** — CM360 sends back the creative asset (image URL, HTML5 bundle, or VAST XML for video) along with tracking pixels.\n\n**5. Ad renders** — The browser displays the creative in the ad slot.\n\n**6. Tracking fires** — An impression pixel fires back to CM360, recording that the ad was served.\n\n**7. Click handling** — If the user clicks, the tag redirects through CM360\'s click tracker (recording the click) and then sends the user to the landing page.\n\nThere are two tag formats:\n- **JavaScript tags** — more common, supports rich features like click tracking and viewability\n- **Iframe tags** — simpler, used as a fallback when JavaScript isn\'t supported\n\nWant to see what a real tag from our account looks like?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'JavaScript',
          description: 'Mentions JavaScript tag type',
        },
        {
          type: 'contains',
          value: 'doubleclick',
          description: 'References the ad server domain',
        },
        {
          type: 'contains',
          value: 'impression',
          description: 'Explains impression tracking',
        },
        {
          type: 'contains',
          value: 'click',
          description: 'Explains click tracking',
        },
      ],
      description:
        'Turn 2: Deeper technical explanation, building on the basics from turn 1',
    },
    {
      userMessage: 'Show me a real tag from our account',
      mockResponses: [
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'cm360_list_profiles',
              input: {},
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_2',
              name: 'cm360_list_advertisers',
              input: { profileId: '12345', searchString: 'Apex' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_3',
              name: 'cm360_list_campaigns',
              input: { profileId: '12345', advertiserId: '90000' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu_4',
              name: 'cm360_list_placements',
              input: { profileId: '12345', campaignId: '90024' },
            },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s a real tag from the **Apex Q1 2026 Display Awareness** campaign:\n\n**Placement:** ESPN_Apex_300x250_0126_Display\n\n**JavaScript tag:**\n```html\n<script src="https://ad.doubleclick.net/ddm/trackimp/N12345.ESPN/B90024;dc_trk_aid=90000;dc_trk_cid=90024;ord=[timestamp];dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;npa=;gdpr=${GDPR};gdpr_consent=${GDPR_CONSENT_755};ltd=?"></script>\n```\n\n**Iframe tag (fallback):**\n```html\n<iframe src="https://ad.doubleclick.net/ddm/trackimp/N12345.ESPN/B90024;dc_trk_aid=90000;dc_trk_cid=90024;ord=[timestamp]" width="300" height="250" frameborder="0"></iframe>\n```\n\nNotice the components we discussed:\n- `ad.doubleclick.net` — CM360\'s ad server\n- `N12345.ESPN` — the network ID and site\n- `B90024` — the campaign ID\n- `300` x `250` — the ad size (in the iframe version)\n- GDPR consent parameters — for privacy compliance\n\nThe publisher would paste the JavaScript tag into their ad server. When someone visits ESPN, this tag fires, CM360 serves the Apex Motors creative, and tracking begins.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'script',
          description: 'Shows actual tag code',
        },
        {
          type: 'contains',
          value: 'doubleclick',
          description: 'Shows real ad server URL',
        },
        {
          type: 'contains',
          value: 'ESPN',
          description: 'Uses real account data',
        },
        {
          type: 'contains',
          value: 'iframe',
          description: 'Shows both tag formats',
        },
      ],
      description:
        'Turn 3: Fetches real data and shows actual tag code, annotating the components discussed in previous turns',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-TM-004: Misconception chain
// User thinks this is Google Ads, gets corrected, learns the difference, then asks what Kiki can do
// ---------------------------------------------------------------------------

const misconceptionChain: ConversationFlow = {
  id: 'FLOW-TM-004',
  name: 'Misconception chain',
  description:
    'User mistakes CM360 for Google Ads, gets gently corrected, learns the difference, then asks about capabilities',
  turns: [
    {
      userMessage: 'I need to set up a Google Ads campaign',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'I appreciate you reaching out! Just a heads up — I work with **Campaign Manager 360 (CM360)**, which is a different platform from Google Ads.\n\n- **Google Ads** is for *buying* ad space (search ads, display buying, bidding)\n- **CM360** is for *serving and trafficking* ads (setting up campaigns, managing placements, generating tags, tracking delivery)\n\nIf you need to set up a CM360 campaign (for trafficking display or video ads), I\'m your assistant! If you need Google Ads specifically (search campaigns, bidding, budget management), that would be a different tool.\n\nDid you mean a CM360 campaign, or are you specifically looking for Google Ads?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'CM360',
          description: 'Clarifies this is CM360',
        },
        {
          type: 'contains',
          value: 'different',
          description: 'States they are different platforms',
        },
        {
          type: 'contains',
          value: 'Google Ads',
          description: 'Addresses the misconception directly',
        },
      ],
      description:
        'Turn 1: Gently corrects the misconception without being dismissive',
    },
    {
      userMessage: 'Oh, what\'s the difference exactly?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s a clear comparison:\n\n**Google Ads (formerly AdWords):**\n- Buy ad space through Google\'s ad network\n- Set budgets, bids, and targeting\n- Manage search ads (text ads on Google.com)\n- Programmatic display buying\n- Self-serve: you manage the spend directly\n\n**CM360 (Campaign Manager 360, formerly DoubleClick):**\n- Serve and track ads across *any* publisher — not just Google\'s network\n- Set up campaigns, create placements, assign creatives\n- Generate ad serving tags and send them to publishers\n- Centralized reporting across all channels\n- Used by agencies managing large, multi-publisher campaigns\n\n**How they relate:**\nA media buyer might use Google Ads (or DV360) to *purchase* ad space. The trafficker then uses CM360 to *manage the delivery* — making sure the right creative shows up in the right slot on the right site.\n\nThink of Google Ads as the "buying desk" and CM360 as the "logistics center."\n\nI\'m on the CM360 (logistics) side — trafficking, campaign setup, placement management, tag generation, and tracking.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Google Ads',
          description: 'Explains Google Ads in detail',
        },
        {
          type: 'contains',
          value: 'CM360',
          description: 'Explains CM360 in detail',
        },
        {
          type: 'contains',
          value: 'trafficking',
          description: 'Mentions trafficking as CM360 focus',
        },
      ],
      description:
        'Turn 2: Provides detailed comparison, building on the correction from turn 1',
    },
    {
      userMessage: 'OK so what can you help me with?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here\'s everything I can help you with in CM360:\n\n**Browse & Look Up:**\n- List advertisers, campaigns, placements, sites, creatives, and ads\n- Search for specific entities by name or ID\n- Get detailed information about any entity\n\n**Create & Set Up:**\n- Create campaigns (with dates, landing pages, and naming conventions)\n- Create placements (specific ad slots on publisher sites)\n- Create landing pages for advertisers\n- Assign creatives to placements through ads\n\n**Generate:**\n- Ad serving tags (JavaScript and iframe) for any placement\n- Organized tag sheets ready to send to publishers\n\n**Teach & Explain:**\n- Walk you through CM360 concepts (placements, tags, trafficking workflow)\n- Explain naming conventions\n- Give you context about the account and its advertisers\n\n**Current account:** We have 7 advertisers (Apex Motors, Luminance Beauty, Meridian Financial, NovaTech Solutions, Vanguard Athletics, Crestview Hotels, Harvest Organics) with campaigns across sites like ESPN, CNN, Forbes, Bloomberg, and more.\n\nWhere would you like to start?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'campaign',
          description: 'Lists campaign management capabilities',
        },
        {
          type: 'contains',
          value: 'placement',
          description: 'Lists placement capabilities',
        },
        {
          type: 'contains',
          value: 'tag',
          description: 'Lists tag generation capabilities',
        },
        {
          type: 'contains',
          value: 'Apex Motors',
          description: 'References account data for context',
        },
      ],
      description:
        'Turn 3: Lists CM360 capabilities clearly, grounding in the real account',
    },
  ],
};

// ---------------------------------------------------------------------------
// Export all teaching-mode conversation flows
// ---------------------------------------------------------------------------

export const TEACHING_MODE_FLOWS: ConversationFlow[] = [
  learningHierarchy,
  teachingMidTask,
  progressiveTagDepth,
  misconceptionChain,
];
