/**
 * Teaching-mode test prompts (40 total).
 *
 * These test that Kiki can teach users about CM360 concepts, explain
 * the trafficking workflow, clarify entity relationships, give
 * contextual examples using real account data, and correct common
 * misconceptions.
 *
 * Sub-categories:
 *   A. Basic Concept Definitions          (TM-001 to TM-010)
 *   B. Workflow / Process                 (TM-011 to TM-018)
 *   C. Relationships / Hierarchy          (TM-019 to TM-026)
 *   D. Practical / Contextual Teaching    (TM-027 to TM-034)  — uses tool calls
 *   E. Edge Cases / Misconceptions        (TM-035 to TM-040)
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

import type { TestPrompt } from './test-prompts.js';

// ---------------------------------------------------------------------------
// A. Basic Concept Definitions (TM-001 to TM-010)
// ---------------------------------------------------------------------------

const basicConcepts: TestPrompt[] = [
  {
    id: 'TM-001',
    prompt: 'What is a placement?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that a placement is a reserved ad slot on a publisher site with a specific size, dates, and pricing',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A **placement** is a reserved ad slot on a publisher\'s website. Think of it as a specific "parking spot" for your ad.\n\nEvery placement has:\n- **Site** — the publisher where the ad appears (e.g., ESPN.com)\n- **Size** — the ad dimensions, i.e. the size of the ad unit (e.g., 300x250, 728x90)\n- **Dates** — when the ad slot is active\n- **Campaign** — the parent campaign it belongs to\n\nPlacements are the core building block of trafficking. When you hear "traffic a campaign," you\'re mostly creating placements and generating the tags that go to publishers.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'placement', description: 'Defines the term' },
      { type: 'contains', value: 'site', description: 'Mentions publisher/site' },
      { type: 'contains', value: 'size', description: 'Mentions ad dimensions' },
    ],
  },
  {
    id: 'TM-002',
    prompt: "What's the difference between a campaign and an ad?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that a campaign is a container with dates/budget, while an ad links a creative to a placement',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Great question — they serve very different roles in CM360:\n\n**Campaign** = a container. It groups everything together for a specific initiative (e.g., "Apex Q1 2026 Display Awareness"). It has start/end dates and a default landing page, and it holds all the placements, ads, and creatives underneath it.\n\n**Ad** = the link between a creative and a placement. It says "show *this* creative (e.g., a 300x250 banner) in *this* placement (e.g., the ESPN ad slot)." An ad is what actually makes a creative appear on a site.\n\nThink of it this way: the campaign is the folder, the placement is the slot, the creative is the artwork, and the ad is the instruction that puts the artwork into the slot.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'campaign', description: 'Explains campaign' },
      { type: 'contains', value: 'ad', description: 'Explains ad' },
      { type: 'contains', value: 'creative', description: 'Mentions creative as part of the relationship' },
    ],
  },
  {
    id: 'TM-003',
    prompt: 'What is a creative in CM360?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that a creative is the actual ad asset — image, HTML5, or video',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A **creative** in CM360 is the actual ad content — the thing the user sees. It can be:\n\n- **Display image** — a static banner (JPG, PNG, GIF)\n- **HTML5** — an interactive/animated rich media ad\n- **Video** — a pre-roll, mid-roll, or outstream video ad\n\nCreatives are uploaded to CM360 at a specific size (e.g., 300x250) and belong to an advertiser. To make a creative actually appear on a website, you link it to a placement through an **ad**.\n\nOne creative can be reused across multiple ads and placements — you don\'t need a separate creative for every placement of the same size.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'creative', description: 'Defines creative' },
      { type: 'contains', value: 'image', description: 'Mentions image format' },
      { type: 'contains', value: 'video', description: 'Mentions video format' },
    ],
  },
  {
    id: 'TM-004',
    prompt: 'Why do I need a landing page to create a campaign?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that CM360 requires a default click-through URL for every campaign',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 requires every campaign to have a **default landing page** — it\'s a mandatory field in the API.\n\nHere\'s why: when someone clicks on any ad in your campaign, CM360 needs to know where to send them. The default landing page is the fallback click-through URL. Even if individual ads have their own landing pages, the campaign-level default acts as a safety net.\n\nBefore creating a campaign, you need to have at least one landing page set up for that advertiser. I can check which landing pages exist for any advertiser if you\'d like!',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'landing page', description: 'Explains landing page requirement' },
      { type: 'contains', value: 'click', description: 'Mentions click-through behavior' },
      { type: 'contains', value: 'default', description: 'Explains the default/fallback role' },
    ],
  },
  {
    id: 'TM-005',
    prompt: 'What are ad serving tags?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that tags are JavaScript/iframe snippets sent to publishers to serve ads',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Ad serving tags are small snippets of code (JavaScript or iframe) that you send to a publisher so they can display your ads on their site.\n\nHere\'s how it works:\n1. You create placements in CM360\n2. CM360 generates a unique tag for each placement\n3. You send those tags to the publisher (usually via email or a tag sheet)\n4. The publisher pastes the tag into their ad server or web page\n5. When a user visits the page, the tag calls CM360, which serves the correct creative\n\nTags look something like:\n```html\n<script src="https://ad.doubleclick.net/ddm/trackimp/..."></script>\n```\n\nI can generate tags for any placement in the account — just tell me which campaign or placement you need tags for.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'tag', description: 'Explains tags' },
      { type: 'contains', value: 'publisher', description: 'Mentions publisher role' },
      { type: 'contains', value: 'script', description: 'Shows example tag format' },
    ],
  },
  {
    id: 'TM-006',
    prompt: "What's a floodlight activity?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that a floodlight activity is a conversion tracking pixel on the advertiser\'s site',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A **floodlight activity** is CM360\'s conversion tracking system. It\'s a small piece of code (a pixel/tag) placed on the advertiser\'s own website — usually on key pages like a purchase confirmation or lead form submission.\n\nWhen a user sees or clicks your ad and later visits that page, the floodlight fires and CM360 records the conversion. This lets you measure whether your ads are actually driving results.\n\nCommon floodlight types:\n- **Counter** — counts page visits (e.g., homepage visits after ad exposure)\n- **Sales** — tracks purchases with revenue data\n\nFloodlights are set up at the advertiser level and can be shared across campaigns. They\'re essential for proving ROI to clients.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'floodlight', description: 'Defines floodlight' },
      { type: 'contains', value: 'conversion', description: 'Mentions conversion tracking' },
      { type: 'contains', value: 'pixel', description: 'Mentions pixel/tag mechanism' },
    ],
  },
  {
    id: 'TM-007',
    prompt: 'What does "trafficking" mean?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that trafficking is the process of setting up campaigns, placements, ads, and generating tags',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: '**Trafficking** is the process of setting up everything needed for an ad campaign to go live. It\'s the operational work between "we have a media plan" and "ads are actually running on publisher sites."\n\nThe trafficking workflow typically includes:\n1. **Creating campaigns** with the correct dates and landing pages\n2. **Creating placements** for each site/size combination in the media plan\n3. **Uploading creatives** (the ad assets)\n4. **Creating ads** that link creatives to placements\n5. **Generating tags** and sending them to publishers\n6. **QA** — verifying everything is set up correctly before launch\n\nA "trafficker" is the person who does this work — and that\'s exactly what I\'m here to help with!',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'trafficking', description: 'Defines trafficking' },
      { type: 'contains', value: 'campaign', description: 'Mentions campaign creation' },
      { type: 'contains', value: 'placement', description: 'Mentions placement creation' },
      { type: 'contains', value: 'tag', description: 'Mentions tag generation' },
    ],
  },
  {
    id: 'TM-008',
    prompt: 'What is a site in CM360?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that a site represents a publisher where ads are placed',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A **site** in CM360 represents a publisher — a website or app where your ads will appear.\n\nExamples of sites in our account include ESPN.com, CNN.com, Forbes.com, and Hulu.com. Each site is set up once in the account and then referenced whenever you create a placement.\n\nWhen you create a placement, you pick:\n- The **campaign** it belongs to\n- The **site** where the ad will run\n- The **size** of the ad\n\nSites are shared across all advertisers in the account, so once ESPN is set up, any advertiser can have placements on ESPN.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'site', description: 'Defines site' },
      { type: 'contains', value: 'publisher', description: 'Mentions publisher concept' },
      { type: 'contains', value: 'placement', description: 'Connects to placements' },
    ],
  },
  {
    id: 'TM-009',
    prompt: "What's the difference between a placement and a placement group?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that a placement is an individual ad slot while a placement group bundles them for billing/delivery',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Good question — they\'re related but serve different purposes:\n\n**Placement** = a single ad slot on a single site at a specific size. For example: "ESPN 300x250 for Apex Motors Q1."\n\n**Placement group** = a bundle of placements grouped together, usually for billing or delivery purposes. There are two types:\n- **Package** — groups placements that share a single budget or impression goal. A package lets you manage delivery as a bundle rather than per individual placement.\n- **Roadblock** — groups placements that must serve together on the same page load. If a user sees one, they see all of them.\n\nNot every placement needs to be in a group. Groups are used when the media plan calls for bundled delivery or pricing — which is common in premium publisher deals.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'placement', description: 'Explains individual placement' },
      { type: 'contains', value: 'group', description: 'Explains placement group' },
      { type: 'contains', value: 'package', description: 'Mentions package type' },
    ],
  },
  {
    id: 'TM-010',
    prompt: 'What are IAB standard sizes?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Lists common IAB ad sizes like 300x250, 728x90, 160x600, 970x250',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'IAB standard sizes are industry-standard ad dimensions defined by the Interactive Advertising Bureau. They ensure ads display consistently across publisher sites.\n\nThe most common sizes you\'ll see in CM360:\n\n| Size | Name | Where It Appears |\n|---|---|---|\n| **300x250** | Medium Rectangle | In-content, sidebar — the most popular size |\n| **728x90** | Leaderboard | Top of page |\n| **160x600** | Wide Skyscraper | Sidebar |\n| **970x250** | Billboard | Top of page (premium) |\n| **300x600** | Half Page | Sidebar (premium) |\n| **320x50** | Mobile Leaderboard | Mobile sites/apps |\n| **300x50** | Mobile Banner | Mobile sites/apps |\n\nWhen you create a placement, the size must match the publisher\'s ad slot. Using standard sizes ensures your creative can run across many publishers without custom resizing.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '300x250', description: 'Lists Medium Rectangle' },
      { type: 'contains', value: '728x90', description: 'Lists Leaderboard' },
      { type: 'contains', value: 'IAB', description: 'References IAB' },
    ],
  },
];

// ---------------------------------------------------------------------------
// B. Workflow / Process (TM-011 to TM-018)
// ---------------------------------------------------------------------------

const workflowProcess: TestPrompt[] = [
  {
    id: 'TM-011',
    prompt: "What's the trafficking workflow from start to finish?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Walks through the full workflow: media plan, campaign, placements, creatives, ads, tags, QA',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s the typical trafficking workflow from start to finish:\n\n**1. Receive the media plan (IO)** — The account team sends you a document listing which sites, sizes, dates, and budgets are booked.\n\n**2. Set up the campaign** — Create a campaign in CM360 with the correct advertiser, dates, and default landing page.\n\n**3. Create placements** — For each line item in the media plan, create a placement with the right site, size, and dates.\n\n**4. Upload creatives** — Add the ad assets (banners, HTML5, video) provided by the creative team.\n\n**5. Create ads** — Link each creative to its target placement(s). This is what actually makes the creative serve on a site.\n\n**6. Generate tags** — CM360 generates JavaScript/iframe tags for each placement.\n\n**7. Send tags to publishers** — Email or share the tag sheet with each publisher\'s ad ops team.\n\n**8. QA** — Verify tags are live, creatives render correctly, click-throughs work, and tracking fires.\n\nI can help with steps 2-6 right here!',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'campaign', description: 'Mentions campaign creation step' },
      { type: 'contains', value: 'placement', description: 'Mentions placement creation step' },
      { type: 'contains', value: 'tag', description: 'Mentions tag generation step' },
      { type: 'contains', value: 'creative', description: 'Mentions creative upload step' },
    ],
  },
  {
    id: 'TM-012',
    prompt: 'What order do I create things in CM360?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains the dependency chain: advertiser, landing page, campaign, placement, creative, ad, tags',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 has a strict creation order because each entity depends on the one above it:\n\n1. **Advertiser** — must exist first (usually already set up)\n2. **Landing page** — must exist before you can create a campaign (CM360 requires a default click-through URL)\n3. **Campaign** — needs an advertiser and a landing page\n4. **Site** — must be registered in the account (usually already set up)\n5. **Placement** — needs a campaign and a site\n6. **Creative** — needs an advertiser (independent of campaigns until linked)\n7. **Ad** — needs a campaign, a placement, and a creative\n8. **Tags** — generated from placements (after everything above is in place)\n\nThe good news: advertisers, landing pages, and sites are usually already set up. For day-to-day trafficking, you\'re mostly doing steps 3-8.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'advertiser', description: 'Starts with advertiser' },
      { type: 'contains', value: 'landing page', description: 'Mentions landing page dependency' },
      { type: 'contains', value: 'campaign', description: 'Shows campaign in order' },
    ],
  },
  {
    id: 'TM-013',
    prompt: 'How do tags get to the publisher?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains the tag delivery process: generate, export, email to publisher ad ops',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s how tags get from CM360 to a publisher:\n\n1. **Generate tags** in CM360 — once your placements are set up, CM360 creates a unique JavaScript or iframe tag for each one.\n\n2. **Export the tag sheet** — tags are typically compiled into a spreadsheet or document, organized by site and placement.\n\n3. **Send to the publisher\'s ad ops team** — usually via email. The publisher needs the tag code, the placement details (size, dates), and any special instructions.\n\n4. **Publisher implements the tags** — their ad ops team pastes the tags into their ad server (like Google Ad Manager) or directly into their web pages.\n\n5. **Verify** — once live, you check that the tags are firing correctly and serving the right creatives.\n\nI can generate tags for any placement in the account. Just tell me which campaign or placement you need tags for, and I\'ll produce them.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'tag', description: 'Discusses tags' },
      { type: 'contains', value: 'publisher', description: 'Explains publisher delivery' },
      { type: 'contains', value: 'email', description: 'Mentions common delivery method' },
    ],
  },
  {
    id: 'TM-014',
    prompt: 'What happens after I create a placement?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains next steps: assign creatives via ads, generate tags, send to publisher',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'After creating a placement, here\'s what comes next:\n\n1. **Assign a creative** — Create an "ad" that links a creative asset to your new placement. Without this, the placement exists but has nothing to show.\n\n2. **Generate tags** — Once the placement (and ideally the ad) is set up, generate the ad serving tag.\n\n3. **Send tags to the publisher** — The publisher needs the tag to implement on their site.\n\n4. **QA** — After the publisher implements the tag, verify that:\n   - The creative renders correctly\n   - Click-throughs go to the right landing page\n   - Impression tracking fires\n\nA placement on its own is just a reserved slot. It becomes "live" once it has a creative assigned and the tags are implemented by the publisher.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'creative', description: 'Mentions creative assignment' },
      { type: 'contains', value: 'tag', description: 'Mentions tag generation' },
      { type: 'contains', value: 'publisher', description: 'Mentions publisher step' },
    ],
  },
  {
    id: 'TM-015',
    prompt: 'Can I create an ad without a creative?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that an ad requires a creative — it is the link between creative and placement',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'No — an ad in CM360 must be linked to at least one creative. That\'s literally what an ad *is* in CM360: the connection between a creative and a placement.\n\nThink of it this way:\n- **Placement** = the slot on the site\n- **Creative** = the artwork\n- **Ad** = the instruction that puts the artwork into the slot\n\nWithout a creative, there\'s nothing to serve. If you create a placement but don\'t have the creative assets yet, that\'s fine — the placement will exist and be ready. You just won\'t be able to create the ad (or generate meaningful tags) until the creative is uploaded.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'creative', description: 'Explains creative requirement' },
      { type: 'contains', value: 'ad', description: 'Explains ad role' },
      { type: 'not_contains', value: 'yes', description: 'Does not say yes (answer is no)' },
    ],
  },
  {
    id: 'TM-016',
    prompt: "What's the difference between creating a campaign and going live?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that creating a campaign is just the first step; going live requires placements, creatives, ads, tags, and publisher implementation',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Creating a campaign is just the very first step — it\'s far from "live."\n\n**Creating a campaign** gives you an empty container with dates and a landing page. No ads will serve yet.\n\n**Going live** means:\n1. Campaign is created with correct dates\n2. Placements are set up for each site/size\n3. Creatives have been uploaded\n4. Ads link creatives to placements\n5. Tags are generated and sent to publishers\n6. Publishers have implemented the tags on their sites\n7. The campaign\'s start date has arrived\n\nOnly when ALL of those steps are done — and the start date has passed — will ads actually begin serving. Creating the campaign is step 1 of 7.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'first step', description: 'Clarifies campaign creation is just the start' },
      { type: 'contains', value: 'live', description: 'Explains what going live requires' },
      { type: 'contains', value: 'tag', description: 'Mentions tags as a required step' },
    ],
  },
  {
    id: 'TM-017',
    prompt: 'How do I know if my campaign is set up correctly?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Provides a checklist: campaign dates, placements created, creatives assigned, ads linking them, tags generated',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Here\'s a quick QA checklist for verifying a campaign setup:\n\n**Campaign level:**\n- Correct advertiser\n- Start and end dates match the media plan\n- Default landing page is set and the URL works\n\n**Placements:**\n- One placement per site/size line in the media plan\n- Placement dates match campaign (or specific flight dates)\n- Sizes match what the publisher booked\n\n**Creatives:**\n- Uploaded and approved\n- Sizes match the placements they\'ll be assigned to\n\n**Ads:**\n- Each placement has an ad linking it to the correct creative\n- Click-through URLs are correct for each ad\n\n**Tags:**\n- Generated for every placement\n- Sent to the correct publisher contacts\n- Publisher has confirmed implementation\n\nI can help you check most of these — just tell me the campaign and I\'ll look up what\'s in place.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'checklist', description: 'Provides a structured checklist' },
      { type: 'contains', value: 'placement', description: 'Includes placement verification' },
      { type: 'contains', value: 'creative', description: 'Includes creative verification' },
    ],
  },
  {
    id: 'TM-018',
    prompt: 'Why do dates matter on placements?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that placement dates control when ads can serve, must align with campaign dates and publisher booking',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Placement dates are critical because they control exactly when ads can serve:\n\n- **Ads only serve within the placement date range.** If the placement runs Jan 1 - Mar 31, no impressions will deliver outside that window — even if the campaign itself has broader dates.\n\n- **Must fall within the campaign dates.** A placement can\'t start before the campaign or end after it.\n\n- **Must match the publisher booking.** The dates should align with what was agreed in the IO (insertion order). If you booked Jan-Mar on ESPN but set the placement to Jan-Feb, you\'ll leave a month of paid inventory unused.\n\n- **Flight management.** Some campaigns have multiple "flights" — e.g., a heavy push in weeks 1-2, then lighter delivery. Placement dates help manage this.\n\nGetting dates wrong is one of the most common trafficking errors. Always double-check them against the media plan.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'date', description: 'Discusses date importance' },
      { type: 'contains', value: 'serve', description: 'Explains serving impact' },
      { type: 'contains', value: 'campaign', description: 'Mentions campaign date alignment' },
    ],
  },
];

// ---------------------------------------------------------------------------
// C. Relationships / Hierarchy (TM-019 to TM-026)
// ---------------------------------------------------------------------------

const relationshipsHierarchy: TestPrompt[] = [
  {
    id: 'TM-019',
    prompt: 'How are campaigns and placements related?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains parent-child relationship: campaign contains placements',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Campaigns and placements have a **parent-child relationship**:\n\n- A **campaign** is the parent container — it represents the overall initiative (e.g., "Apex Q1 2026 Display Awareness")\n- **Placements** are the children — they sit inside a campaign and represent specific ad slots on specific sites\n\nEvery placement belongs to exactly one campaign. A campaign can have many placements.\n\nExample:\n```\nApex Q1 2026 Display Awareness (campaign)\n  ├── ESPN_Apex_300x250_0126 (placement)\n  ├── CNN_Apex_728x90_0126 (placement)\n  └── Forbes_Apex_300x600_0126 (placement)\n```\n\nThe campaign provides the dates and landing page defaults; each placement specifies the exact site, size, and potentially its own date range within the campaign.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'parent', description: 'Describes parent-child relationship' },
      { type: 'contains', value: 'campaign', description: 'Mentions campaign as parent' },
      { type: 'contains', value: 'placement', description: 'Mentions placement as child' },
    ],
  },
  {
    id: 'TM-020',
    prompt: 'Can one creative be used in multiple ads?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Yes, one creative can be linked to many ads/placements as long as the size matches',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Yes, absolutely — and yes, this is actually a common and efficient practice! One creative can be used across multiple ads.\n\nFor example, if you have a single 300x250 banner for Apex Motors, you can create ads that link that same creative to:\n- The ESPN 300x250 placement\n- The CNN 300x250 placement\n- The Forbes 300x250 placement\n\nThe key requirement is that the **creative size must match the placement size**. You can\'t put a 300x250 creative into a 728x90 placement.\n\nThis reuse is one of CM360\'s strengths — you upload once and deploy everywhere, which keeps things consistent and easy to manage.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'yes', description: 'Confirms reuse is possible' },
      { type: 'contains', value: 'size', description: 'Mentions size matching requirement' },
      { type: 'contains', value: 'multiple', description: 'Confirms multiple usage' },
    ],
  },
  {
    id: 'TM-021',
    prompt: 'Can a placement be in multiple campaigns?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'No, a placement belongs to exactly one campaign. Explain workaround: create separate placements',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'No — a placement belongs to exactly **one campaign**. This is a hard constraint in CM360.\n\nIf you need the same site/size combination in multiple campaigns, you create separate placements — one in each campaign. They can use the same site and size, but they\'ll be distinct placement entities with their own IDs, dates, and tags.\n\nFor example:\n- Campaign A: ESPN_ApexQ1_300x250_0126\n- Campaign B: ESPN_ApexQ2_300x250_0426\n\nSame site, same size, but different placements in different campaigns with different date ranges and their own tags.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'one campaign', description: 'States one-campaign limit' },
      { type: 'contains', value: 'separate', description: 'Explains workaround' },
    ],
  },
  {
    id: 'TM-022',
    prompt: "What's the relationship between an advertiser and a site?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that advertisers and sites are independent — any advertiser can have placements on any site',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Advertisers and sites are **independent entities** in CM360 — there\'s no direct ownership or dependency between them.\n\n- **Advertisers** represent brands (e.g., Apex Motors, Luminance Beauty)\n- **Sites** represent publishers (e.g., ESPN, CNN, Forbes)\n\nThe connection happens through **placements**: when you create a placement, you choose both the campaign (which belongs to an advertiser) and the site.\n\nThis means any advertiser can have placements on any site. Apex Motors can advertise on ESPN, CNN, and Forbes. Luminance Beauty can also advertise on ESPN, CNN, and Forbes. The sites are shared across the account.\n\nThink of it like a marketplace: advertisers are the buyers, sites are the sellers, and placements are the individual deals.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'independent', description: 'Clarifies independence' },
      { type: 'contains', value: 'placement', description: 'Shows connection through placements' },
    ],
  },
  {
    id: 'TM-023',
    prompt: 'Can I use the same landing page for multiple campaigns?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Yes, landing pages belong to the advertiser and can be reused across campaigns',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Yes — and yes, this is a very common practice! Landing pages belong to the **advertiser**, not to a specific campaign. So any landing page you set up for an advertiser can be reused as the default for multiple campaigns under that same advertiser.\n\nFor example, if Apex Motors has a landing page pointing to `https://www.apexmotors.com`, you can use it as the default landing page for:\n- Apex Q1 2026 Display Awareness\n- Apex Q2 2026 Video Conversions\n- Apex Q3 2026 Mobile Retargeting\n\nYou can also create campaign-specific landing pages if needed (e.g., a promo page for a seasonal campaign). Most advertisers have a mix of evergreen and campaign-specific landing pages.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'yes', description: 'Confirms reuse is possible' },
      { type: 'contains', value: 'advertiser', description: 'Explains advertiser-level ownership' },
    ],
  },
  {
    id: 'TM-024',
    prompt: "What happens if a campaign's landing page is deleted?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that the campaign would need a new default landing page; clicks would fail without one',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'In practice, CM360 doesn\'t let you delete a landing page that\'s actively in use as a campaign\'s default — it will block the deletion.\n\nBut if a landing page were removed:\n- The campaign would need a new default landing page assigned\n- Any ads using that landing page for click-throughs would fail — clicks would go nowhere or hit an error page\n- Tags already generated would still reference the old URL until regenerated\n\nThis is why it\'s important to:\n1. Never delete landing pages without checking what campaigns use them\n2. Keep landing page URLs working even after campaigns end (for late conversions)\n3. Use persistent, evergreen URLs when possible\n\nIf you\'re not sure which campaigns use a specific landing page, I can help you look that up.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'landing page', description: 'Discusses landing page deletion' },
      { type: 'contains', value: 'click', description: 'Explains click-through impact' },
    ],
  },
  {
    id: 'TM-025',
    prompt: 'How many placements can a campaign have?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains there is no hard limit, but practical campaigns range from a handful to hundreds depending on scope',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'There\'s no hard cap on the number of placements in a campaign — CM360 can handle hundreds or even thousands.\n\nIn practice, the count depends on the campaign scope:\n- **Small campaign:** 3-10 placements (a few sites, a few sizes)\n- **Mid-size campaign:** 20-50 placements (multiple sites, multiple sizes, maybe different flights)\n- **Large campaign:** 100+ placements (national media buy across many publishers)\n- **Enterprise campaigns:** 500+ placements (multi-market, multi-format, multi-flight)\n\nThe main practical limits are:\n- **Tag management** — more placements = more tags to send to publishers\n- **QA effort** — every placement needs to be verified\n- **Naming discipline** — consistent naming conventions become critical at scale\n\nFor our account, campaigns typically have 3-12 placements each.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'no', description: 'States there is no hard limit' },
      { type: 'contains', value: 'placement', description: 'Discusses placement counts' },
    ],
  },
  {
    id: 'TM-026',
    prompt: "What's the difference between a display placement and a video placement?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains display vs in-stream video placement types, sizes, and tag formats',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Display and video placements differ in type, size, and how they serve:\n\n**Display placement:**\n- Type: `DISPLAY` in CM360\n- Shows static or rich media ads (images, HTML5, animated banners)\n- Standard IAB sizes: 300x250, 728x90, 160x600, etc.\n- Tags are JavaScript or iframe snippets\n- Appears within a web page alongside content\n\n**Video placement:**\n- Type: `IN_STREAM_VIDEO` in CM360\n- Shows video ads (pre-roll, mid-roll, post-roll)\n- Size is usually 1x1 (placeholder) since the video player handles dimensions\n- Tags are VAST-compliant XML URLs\n- Appears within a video player (e.g., before a YouTube video or Hulu show)\n\nThe key difference is in how they\'re delivered: display tags render directly in the page, while video tags are consumed by a video player using the VAST standard.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'display', description: 'Explains display type' },
      { type: 'contains', value: 'video', description: 'Explains video type' },
      { type: 'contains', value: 'VAST', description: 'Mentions VAST standard' },
    ],
  },
];

// ---------------------------------------------------------------------------
// D. Practical / Contextual Teaching (TM-027 to TM-034) — uses tool calls
// ---------------------------------------------------------------------------

const practicalTeaching: TestPrompt[] = [
  {
    id: 'TM-027',
    prompt: 'Show me an example of a placement name',
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Fetches real placements and explains the naming pattern with a real example',
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
          {
            type: 'text',
            text: 'Here\'s a real placement name from the account:\n\n**ESPN_Apex_300x250_0126_Display**\n\nLet me break down the naming convention:\n- **ESPN** — the publisher/site\n- **Apex** — the advertiser (Apex Motors)\n- **300x250** — the ad size\n- **0126** — the month/year (January 2026)\n- **Display** — the placement type\n\nThis pattern makes it easy to identify what a placement is at a glance: `Site_Advertiser_WxH_MMYY_Type`. Consistent naming is essential when you have dozens or hundreds of placements — it keeps tags organized and makes QA much faster.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ESPN', description: 'Uses real site name' },
      { type: 'contains', value: 'Apex', description: 'Uses real advertiser' },
      { type: 'contains', value: '300x250', description: 'Shows a real size' },
      { type: 'contains', value: 'naming', description: 'Explains the naming convention' },
    ],
  },
  {
    id: 'TM-028',
    prompt: 'What does a typical campaign look like?',
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_campaigns'],
    expectedBehavior: 'Fetches real campaigns and explains the structure of a typical one',
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
          {
            type: 'text',
            text: 'Here\'s what a typical campaign looks like using a real one from our account:\n\n**Apex Q1 2026 Display Awareness**\n- **Advertiser:** Apex Motors (90000)\n- **Start Date:** 2026-01-01\n- **End Date:** 2026-03-31\n- **Landing Page:** Apex Motors Homepage\n\nThe name tells you everything: the brand (Apex), the quarter (Q1 2026), the channel (Display), and the objective (Awareness).\n\nUnder this campaign, you\'d find:\n- Several placements across sites like ESPN, CNN, and Forbes\n- Each placement at a specific size (300x250, 728x90, etc.)\n- Creatives assigned via ads\n- Tags generated for each placement\n\nOur account follows a consistent naming pattern: `Advertiser Quarter Year Channel Objective`. This makes it easy to find and organize campaigns.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex', description: 'Shows a real campaign example' },
      { type: 'contains', value: 'Q1', description: 'References quarter' },
      { type: 'contains', value: 'placement', description: 'Explains what lives under a campaign' },
    ],
  },
  {
    id: 'TM-029',
    prompt: 'How are our placements named?',
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Fetches placements and explains the Site_Adv_WxH_MMYY_Type naming pattern',
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
          {
            type: 'text',
            text: 'Our account follows a consistent placement naming convention:\n\n**`Site_Advertiser_WxH_MMYY_Type`**\n\nHere are some real examples from the account:\n- `ESPN_Apex_300x250_0126_Display`\n- `CNN_Luminance_728x90_0126_Display`\n- `Forbes_Meridian_300x600_0426_Display`\n\nBreaking it down:\n| Segment | Meaning | Example |\n|---|---|---|\n| Site | Publisher name | ESPN, CNN, Forbes |\n| Advertiser | Brand short name | Apex, Luminance, Meridian |\n| WxH | Width x Height | 300x250, 728x90 |\n| MMYY | Start month/year | 0126 = Jan 2026 |\n| Type | Placement type | Display, Video |\n\nThis convention makes it easy to identify any placement at a glance and keeps tag sheets organized. When I create placements, I\'ll follow this same pattern.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Site', description: 'Explains site component' },
      { type: 'contains', value: 'Advertiser', description: 'Explains advertiser component' },
      { type: 'matches_pattern', value: '\\d+x\\d+', description: 'Shows size pattern' },
    ],
  },
  {
    id: 'TM-030',
    prompt: 'What sizes are we using?',
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_placements'],
    expectedBehavior: 'Fetches placements, aggregates by size, and explains each size',
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
          {
            type: 'text',
            text: 'Based on all placements in the account, here are the ad sizes we\'re currently using:\n\n| Size | IAB Name | Count | Usage |\n|---|---|---|---|\n| **300x250** | Medium Rectangle | 18 | Most popular — in-content and sidebar |\n| **728x90** | Leaderboard | 15 | Top of page, high visibility |\n| **160x600** | Wide Skyscraper | 12 | Sidebar, persistent |\n| **300x600** | Half Page | 10 | Premium sidebar |\n| **970x250** | Billboard | 8 | Premium top of page |\n| **320x50** | Mobile Leaderboard | 6 | Mobile placements |\n\nThe 300x250 (Medium Rectangle) is the workhorse — it works almost everywhere and has the highest publisher acceptance. The 728x90 (Leaderboard) is the second most common, used primarily for desktop top-of-page positions.\n\nAll of these are IAB standard sizes, which means they\'re accepted by virtually every publisher.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '300x250', description: 'Lists most common size' },
      { type: 'contains', value: '728x90', description: 'Lists leaderboard' },
      { type: 'contains', value: 'IAB', description: 'References IAB standards' },
    ],
  },
  {
    id: 'TM-031',
    prompt: "Explain the Apex Motors account to me like I'm new",
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements', 'cm360_list_creatives'],
    expectedBehavior: 'Does multiple lookups and provides a beginner-friendly overview of the Apex Motors advertiser',
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
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90000' } },
          { type: 'tool_use', id: 'tu_5', name: 'cm360_list_creatives', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'Welcome! Here\'s a beginner-friendly overview of Apex Motors in our account:\n\n**Who they are:** Apex Motors (ID: 90000) is an automotive advertiser. They\'re one of 7 brands we manage in the Demo Agency account.\n\n**Their campaigns:** Apex has 3 active campaigns, one per quarter:\n1. **Apex Q1 2026 Display Awareness** (Jan-Mar) — banner ads focused on brand awareness\n2. **Apex Q2 2026 Video Conversions** (Apr-Jun) — video ads driving conversions\n3. **Apex Q3 2026 Mobile Retargeting** (Jul-Sep) — mobile ads targeting past visitors\n\n**Their placements:** About 12 placements across sites like ESPN, CNN, and Forbes, in sizes like 300x250 and 728x90.\n\n**Their creatives:** 2 display creatives (300x250 and 728x90 banners).\n\n**In plain English:** We\'re running banner and video ads for a car company across sports, news, and business websites throughout 2026. Each quarter focuses on a different goal (awareness, then conversions, then retargeting).\n\nWant me to drill into any specific campaign or show you the placements?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Apex Motors', description: 'Names the advertiser' },
      { type: 'contains', value: 'campaign', description: 'Covers campaigns' },
      { type: 'contains', value: 'placement', description: 'Covers placements' },
      { type: 'contains', value: 'creative', description: 'Covers creatives' },
    ],
  },
  {
    id: 'TM-032',
    prompt: 'What would I need to do to add a new campaign for Luminance Beauty?',
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Looks up Luminance Beauty, then explains the steps needed to create a campaign for them',
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
          {
            type: 'text',
            text: 'Good news — **Luminance Beauty** (ID: 90001) is already set up as an advertiser, so half the work is done. Here\'s what you\'d need:\n\n**What you\'ll need to provide:**\n1. **Campaign name** — e.g., "Luminance Beauty Q3 2026 Holiday Promo"\n2. **Start and end dates** — when does the campaign run?\n3. **Landing page** — Luminance Beauty already has a homepage landing page set up. You can use that or create a new campaign-specific one.\n\n**Steps I\'d take:**\n1. Verify the landing page exists (already done, they have one)\n2. Create the campaign with the name, dates, and landing page\n3. Show you a preview before I actually create it\n4. After you approve, create the campaign\n\n**After the campaign is created:**\n5. Create placements (you\'ll need to tell me which sites and sizes)\n6. Assign creatives via ads\n7. Generate tags\n\nWant to get started? Just give me a name, dates, and I\'ll set it up!',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Luminance Beauty', description: 'References the correct advertiser' },
      { type: 'contains', value: 'name', description: 'Asks for campaign name' },
      { type: 'contains', value: 'date', description: 'Asks for dates' },
      { type: 'contains', value: 'landing page', description: 'Mentions landing page requirement' },
    ],
  },
  {
    id: 'TM-033',
    prompt: "I'm new here. What is all this?",
    category: 'teaching-mode',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Fetches account info and provides a welcoming orientation to CM360 and the account',
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
            text: 'Welcome! I\'m Kiki, your CM360 trafficking assistant. Let me get you oriented.\n\n**What is CM360?**\nCampaign Manager 360 is Google\'s ad serving platform. It\'s where agencies set up, manage, and track digital ad campaigns for their clients.\n\n**What is this account?**\nYou\'re in the **Demo Agency** account (ID: 67890). We manage digital advertising for 7 brands:\n\n1. **Apex Motors** — automotive\n2. **Luminance Beauty** — cosmetics/beauty\n3. **Meridian Financial** — financial services\n4. **NovaTech Solutions** — technology\n5. **Vanguard Athletics** — sports/athletic wear\n6. **Crestview Hotels** — hospitality\n7. **Harvest Organics** — organic food\n\n**What do I do?**\nI help you "traffic" campaigns — which means setting up the technical plumbing so ads appear on publisher websites. I can create campaigns, set up placements, generate tags, and explain anything along the way.\n\n**Where should we start?**\nI can:\n- Show you what\'s currently set up for any advertiser\n- Walk you through how trafficking works\n- Help you create something new\n\nWhat sounds most helpful?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Kiki', description: 'Introduces herself' },
      { type: 'contains', value: 'CM360', description: 'Explains the platform' },
      { type: 'contains', value: 'Demo Agency', description: 'Names the account' },
      { type: 'contains', value: 'Apex Motors', description: 'Lists an advertiser' },
    ],
  },
  {
    id: 'TM-034',
    prompt: "What's a 300x250?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains the 300x250 Medium Rectangle ad size with no tool calls needed',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'A **300x250** is the most common display ad size, called a **Medium Rectangle** (or "med rec" in industry shorthand).\n\n- **300** pixels wide, **250** pixels tall\n- It\'s an IAB standard size, meaning virtually every publisher supports it\n- Usually appears **within article content** or in the **sidebar**\n- Works on both desktop and mobile\n\nIt\'s the "Swiss Army knife" of ad sizes — if you\'re only going to create one size for a campaign, this is usually the one to choose. It has the highest fill rates, the widest publisher acceptance, and works well for both static images and rich media.\n\nIn our account, 300x250 is the most-used size by a significant margin.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '300x250', description: 'References the size' },
      { type: 'contains', value: 'Medium Rectangle', description: 'Gives the IAB name' },
      { type: 'contains', value: 'IAB', description: 'References IAB standard' },
    ],
  },
];

// ---------------------------------------------------------------------------
// E. Edge Cases / Misconceptions (TM-035 to TM-040)
// ---------------------------------------------------------------------------

const misconceptions: TestPrompt[] = [
  {
    id: 'TM-035',
    prompt: 'Is CM360 the same as Google Ads?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Clearly explains that CM360 and Google Ads are different platforms',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'No — they\'re different platforms that serve different purposes, even though both are owned by Google.\n\n**Google Ads** (formerly AdWords):\n- For buying ads — search, display, video, shopping\n- Advertisers set budgets and bids\n- Focuses on media buying and optimization\n- Self-serve platform for advertisers\n\n**Campaign Manager 360 (CM360)** (formerly DoubleClick Campaign Manager):\n- For *serving and tracking* ads — not buying them\n- Agencies use it to traffic campaigns, generate tags, and measure delivery\n- Focuses on ad serving, tag management, and attribution\n- Used by agencies managing campaigns across many publishers\n\nThink of it this way: Google Ads is where you *buy* the ad space. CM360 is where you *manage the ad delivery* across all the places you\'ve bought space — including Google Ads, but also publisher-direct deals.\n\nI work with CM360, so I help with trafficking, tag generation, and campaign setup — not with bidding or budget management.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'different', description: 'States they are different' },
      { type: 'contains', value: 'Google Ads', description: 'Explains Google Ads' },
      { type: 'contains', value: 'CM360', description: 'Explains CM360' },
    ],
  },
  {
    id: 'TM-036',
    prompt: 'Can Kiki run my campaign for me?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Clarifies that Kiki helps with trafficking setup, not campaign management/optimization',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'I can help you *set up* a campaign — but I don\'t *run* campaigns in the sense of managing budgets, optimizing delivery, or making real-time adjustments.\n\n**What I can do:**\n- Create campaigns, placements, and ads\n- Upload and assign creatives\n- Generate ad serving tags\n- Look up account data (campaigns, placements, sites, etc.)\n- Explain CM360 concepts and teach you the workflow\n- QA your setup by reviewing what\'s in place\n\n**What I can\'t do:**\n- Manage budgets or pacing\n- Optimize delivery in real-time\n- Set bid strategies or targeting\n- Access performance metrics like impressions/clicks (that\'s reporting, which isn\'t available yet)\n- Make decisions about media strategy\n\nI\'m your **trafficking assistant** — I handle the technical setup so your campaigns can go live. The strategic decisions (budget, targeting, optimization) are still in your hands.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'set up', description: 'Clarifies setup role' },
      { type: 'contains', value: 'can\'t', description: 'Explains limitations' },
      { type: 'contains', value: 'trafficking', description: 'Identifies as trafficking assistant' },
    ],
  },
  {
    id: 'TM-037',
    prompt: "What's the difference between CM360 and DV360?",
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains CM360 is ad serving/trafficking, DV360 is programmatic buying',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'These two often get confused because they\'re both part of Google\'s marketing platform suite. Here\'s the breakdown:\n\n**CM360 (Campaign Manager 360):**\n- **Purpose:** Ad serving and trafficking\n- **What it does:** Creates campaigns, manages placements, generates tags, tracks conversions\n- **Who uses it:** Trafficking teams at agencies\n- **Analogy:** The "logistics" system — it delivers the ads and tracks what happened\n\n**DV360 (Display & Video 360):**\n- **Purpose:** Programmatic media buying\n- **What it does:** Buys ad inventory through real-time bidding (RTB), manages DSP campaigns, optimizes spend\n- **Who uses it:** Media buyers and trading desks\n- **Analogy:** The "purchasing" system — it decides where and when to buy ad space\n\n**How they work together:** A media buyer uses DV360 to purchase programmatic inventory. Those campaigns can be tracked in CM360 for unified reporting alongside direct-buy (non-programmatic) campaigns. CM360 acts as the single source of truth for all ad delivery.\n\nI work with CM360 — the trafficking and ad serving side.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'CM360', description: 'Explains CM360' },
      { type: 'contains', value: 'DV360', description: 'Explains DV360' },
      { type: 'contains', value: 'programmatic', description: 'Mentions programmatic buying' },
      { type: 'contains', value: 'trafficking', description: 'Mentions trafficking' },
    ],
  },
  {
    id: 'TM-038',
    prompt: 'Do I need to know HTML to use tags?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'No, CM360 generates tags automatically — you just need to share them with publishers',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'No! You don\'t need to know HTML at all.\n\nCM360 generates the tags automatically based on the placements you\'ve set up. The tags are pre-built code snippets — you don\'t write them, edit them, or even need to understand what\'s inside them.\n\nYour workflow with tags is:\n1. Tell me which placements need tags\n2. I generate them through CM360\n3. You copy/paste them into an email or tag sheet\n4. Send them to the publisher\'s ad ops team\n5. The publisher implements them on their end\n\nThe publisher\'s tech team handles the implementation. As a trafficker, you just need to know *which* tags go to *which* publisher — and that\'s something I can help organize.\n\nThe only time you might look at the tag code is during QA, to verify the right placement IDs are in there. But even that\'s more of a sanity check than actual coding.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'No', description: 'Answers no' },
      { type: 'contains', value: 'automatically', description: 'Explains auto-generation' },
      { type: 'contains', value: 'publisher', description: 'Mentions publisher handles implementation' },
    ],
  },
  {
    id: 'TM-039',
    prompt: 'What happens if a placement expires?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that ads stop serving when placement dates end',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'When a placement\'s end date passes, ads stop serving for that placement. Here\'s exactly what happens:\n\n1. **Ads stop delivering** — CM360 will not serve any more impressions for that placement, even if the publisher\'s tag is still on their site.\n\n2. **Tags go silent** — the tag on the publisher\'s page will still exist, but it won\'t return any creative. Depending on the publisher\'s setup, the space might show a blank, a house ad, or collapse.\n\n3. **Data is preserved** — all historical delivery data (impressions, clicks) remains in CM360 for reporting.\n\n4. **The placement still exists** — it isn\'t deleted, just inactive. You can see it in the account as a completed placement.\n\n5. **Tags are NOT reusable** — if you need to run on the same site again, you\'d create a new placement with new dates and generate new tags.\n\nIf a placement expired earlier than intended, the fix is to either extend the end date (if possible) or create a new placement.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'stop', description: 'Explains ads stop serving' },
      { type: 'contains', value: 'date', description: 'References date expiration' },
      { type: 'contains', value: 'data', description: 'Mentions data preservation' },
    ],
  },
  {
    id: 'TM-040',
    prompt: 'Can I undo creating a placement?',
    category: 'teaching-mode',
    expectedTools: [],
    expectedBehavior: 'Explains that placements cannot be deleted in CM360, only archived',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'You can\'t delete a placement in CM360 — that\'s a deliberate design choice for audit trail purposes. Once created, a placement exists permanently in the system.\n\nHowever, you can:\n\n- **Archive it** — mark it as archived so it doesn\'t show up in active lists. This is the closest thing to "deleting" it.\n- **Set it to end immediately** — change the end date to today so it stops serving right away.\n- **Never generate tags** — if you created it by mistake and haven\'t sent tags to the publisher, just leave it. No tags = no ad delivery = no impact.\n\nThis is why I always show you a **preview** before creating anything and ask for confirmation. It\'s much easier to catch mistakes before creation than to clean them up after.\n\nThe same applies to campaigns and ads — CM360 doesn\'t support hard deletes for most entities. It\'s an audit trail feature that enterprise clients actually appreciate.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'can\'t delete', description: 'States deletion is not possible' },
      { type: 'contains', value: 'archive', description: 'Mentions archive as alternative' },
      { type: 'contains', value: 'preview', description: 'References the preview/confirmation flow' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Export all teaching-mode prompts
// ---------------------------------------------------------------------------

export const TEACHING_MODE_PROMPTS: TestPrompt[] = [
  ...basicConcepts,
  ...workflowProcess,
  ...relationshipsHierarchy,
  ...practicalTeaching,
  ...misconceptions,
];
