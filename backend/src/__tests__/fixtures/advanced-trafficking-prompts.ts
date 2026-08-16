/**
 * Advanced trafficking test prompts (30 total).
 *
 * These test that Kiki can handle CM360 macros, third-party tool
 * integration (Adobe Analytics, Demandbase), UTM injection workflows,
 * verification vendors (DoubleVerify, IAS), and complex multi-tool
 * data workflows.
 *
 * Sub-categories:
 *   A. CM360 Macros — Basic Knowledge        (AT-001 to AT-006)
 *   B. UTM Injection with Macros             (AT-007 to AT-012)
 *   C. Adobe Analytics Integration           (AT-013 to AT-018)
 *   D. Demandbase / B2B Integration          (AT-019 to AT-022)
 *   E. Verification Vendors & Complex Workflows (AT-023 to AT-026)
 *   F. Complex Data Workflow Recommendations  (AT-027 to AT-030)
 *
 * Mock data reference (seeded from mock-data-store.ts):
 *   Profile ID: 12345 | Account: 67890 (Demo Agency)
 *   Advertisers: 90000 Apex Motors, 90001 Luminance Beauty,
 *                90002 Meridian Financial, 90003 NovaTech Solutions,
 *                90004 Vanguard Athletics, 90005 Crestview Hotels,
 *                90006 Harvest Organics
 *   Sites: 90007 ESPN, 90008 CNN, 90009 Forbes, 90010 Bloomberg,
 *          90011 NYTimes, 90012 WashingtonPost, 90013 TheVerge,
 *          90014 TechCrunch, 90015 Hulu, 90016 Spotify
 */

import type { TestPrompt } from './test-prompts.js';

// ---------------------------------------------------------------------------
// A. CM360 Macros — Basic Knowledge (AT-001 to AT-006)
// ---------------------------------------------------------------------------

const cm360MacrosBasic: TestPrompt[] = [
  {
    id: 'AT-001',
    prompt: 'What macros does CM360 support?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Lists the major CM360 macros including %epid!, %eaid!, %n, %ecid!, %eadv!, %ebuy!',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 supports several dynamic macros that get replaced with real values at ad serve time. Here are the most commonly used ones:\n\n| Macro | What It Inserts | Example Use |\n|---|---|---|\n| **%epid!** | Placement ID | Tracking which placement drove a click |\n| **%eaid!** | Ad ID | Identifying the specific ad served |\n| **%ecid!** | Creative ID | Knowing which creative version was shown |\n| **%ebuy!** | Campaign (buy) ID | Associating data back to a campaign |\n| **%eadv!** | Advertiser ID | Identifying the advertiser at serve time |\n| **%esid!** | Site ID | Identifying the publisher site |\n| **%n** | Cache buster (random number) | Preventing browser caching of ad calls |\n\nThese macros are typically placed in click-through URLs or tracking parameters. When CM360 serves the ad, it replaces each macro with the actual value — so `%epid!` becomes the real placement ID like `90024`.\n\nWant me to show you how to use any of these in a specific scenario?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%epid!', description: 'Lists the placement ID macro' },
      { type: 'contains', value: '%eaid!', description: 'Lists the ad ID macro' },
      { type: 'contains', value: '%n', description: 'Lists the cache buster macro' },
    ],
  },
  {
    id: 'AT-002',
    prompt: 'What macro do I use to pass the placement ID into a URL?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends %epid! for passing placement ID into URLs',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Use the **%epid!** macro to pass the placement ID into a URL. When CM360 serves the ad, it automatically replaces `%epid!` with the actual numeric placement ID.\n\nFor example, if you want the landing page URL to include the placement ID for analytics tracking, you would structure the click-through URL like this:\n\n```\nhttps://www.example.com/landing?placement=%epid!\n```\n\nAt serve time, CM360 replaces it with the real value:\n```\nhttps://www.example.com/landing?placement=90024\n```\n\nThis is especially useful when you want to track which specific placement drove each click or conversion in your analytics platform. It gives you placement-level granularity without needing to manually create separate URLs for each placement.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%epid!', description: 'Recommends the %epid! macro' },
      { type: 'contains', value: 'placement', description: 'Explains it passes the placement ID' },
    ],
  },
  {
    id: 'AT-003',
    prompt: 'How do I add a cache buster to my tags?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains the %n macro for cache busting and why random numbers prevent caching',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Use the **%n** macro to add a cache buster to your tags. CM360 replaces `%n` with a random number each time the tag fires, which prevents browsers and proxies from serving a cached version of the ad call.\n\nHere is how it works:\n\n**Why you need it:** Browsers and CDNs cache identical URLs. Without a cache buster, a user might see the same cached ad response repeatedly instead of a fresh ad call — which means impressions go untracked and frequency capping does not work.\n\n**Where to use it:** The `%n` macro is typically appended as a query parameter in the impression tracking URL:\n```\nhttps://ad.doubleclick.net/ddm/trackimp/...;ord=%n\n```\n\nAt serve time, `%n` becomes a random number like `8472619305`, making every request URL unique.\n\n**Good news:** CM360-generated tags already include `%n` in the `ord=` parameter by default. You usually only need to add it manually if you are building custom tracking URLs or modifying third-party tags.\n\nThe `ord=%n` pattern is the industry standard for cache busting across all major ad servers.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%n', description: 'Mentions the %n cache buster macro' },
      { type: 'contains', value: 'random', description: 'Explains random number generation' },
    ],
  },
  {
    id: 'AT-004',
    prompt: "What's the difference between %ebuy! and %epid!?",
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains %ebuy! is the campaign/buy ID while %epid! is the placement ID',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Great question — they operate at different levels of the CM360 hierarchy:\n\n**%ebuy!** — Inserts the **campaign (buy) ID**\n- This is the campaign-level identifier\n- Use it when you need to know which campaign a served impression belongs to\n- Example: if the campaign ID is 90024, `%ebuy!` resolves to `90024`\n\n**%epid!** — Inserts the **placement ID**\n- This is the placement-level identifier — more granular than campaign\n- Use it when you need to know the exact site/size combination that served the ad\n- Example: if the placement ID is 90050, `%epid!` resolves to `90050`\n\n**When to use which:**\n- Use `%ebuy!` for campaign-level attribution (e.g., `utm_campaign=%ebuy!`)\n- Use `%epid!` for placement-level attribution (e.g., `utm_content=%epid!`)\n- Use both together for full granularity: `?campaign=%ebuy!&placement=%epid!`\n\nSince one campaign can have many placements, `%epid!` gives you finer-grained tracking. Most analytics setups use both — campaign for the high-level view and placement for the detailed breakdown.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'campaign', description: 'Explains %ebuy! relates to campaign' },
      { type: 'contains', value: 'placement', description: 'Explains %epid! relates to placement' },
    ],
  },
  {
    id: 'AT-005',
    prompt: 'I need to pass the creative ID to my analytics platform',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends %ecid! for passing creative ID',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Use the **%ecid!** macro to pass the creative ID to your analytics platform. When CM360 serves the ad, it replaces `%ecid!` with the numeric ID of the creative that was actually shown to the user.\n\nHere is how to set it up in your click-through URL:\n\n```\nhttps://www.example.com/landing?creative=%ecid!\n```\n\nAt serve time, this becomes:\n```\nhttps://www.example.com/landing?creative=90100\n```\n\nThis is especially valuable when you have **multiple creatives in rotation** on the same placement. Without `%ecid!`, you would only know which placement served — but not which specific creative the user saw before clicking.\n\n**Common analytics setup:**\n```\n?utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!&utm_term=%epid!\n```\n\nThis gives you campaign-level, creative-level, and placement-level tracking all in one URL.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%ecid!', description: 'Recommends the %ecid! macro' },
      { type: 'contains', value: 'creative', description: 'Explains it passes the creative ID' },
    ],
  },
  {
    id: 'AT-006',
    prompt: 'Which macro gives me the advertiser ID at serve time?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends %eadv! for the advertiser ID',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'The **%eadv!** macro gives you the advertiser ID at serve time. CM360 replaces `%eadv!` with the numeric advertiser ID when the ad is served.\n\nFor example:\n```\nhttps://www.example.com/landing?advertiser=%eadv!\n```\n\nBecomes:\n```\nhttps://www.example.com/landing?advertiser=90000\n```\n\n(Where 90000 is Apex Motors\' advertiser ID in our account.)\n\n**When to use %eadv!:**\n- Multi-brand agencies managing several advertisers in one CM360 account\n- Analytics platforms that need to segment data by advertiser\n- Cases where you are using a shared landing page domain across multiple brands\n\n**When you probably do not need it:**\n- If each advertiser has its own landing page domain (the domain itself identifies the brand)\n- If you are only working with one advertiser at a time\n\nThe %eadv! macro is less commonly used than %epid! or %ecid! because most click-through URLs are already advertiser-specific, but it is handy for multi-brand analytics dashboards.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%eadv!', description: 'Recommends the %eadv! macro' },
      { type: 'contains', value: 'advertiser', description: 'Explains it returns the advertiser ID' },
    ],
  },
];

// ---------------------------------------------------------------------------
// B. UTM Injection with Macros (AT-007 to AT-012)
// ---------------------------------------------------------------------------

const utmInjection: TestPrompt[] = [
  {
    id: 'AT-007',
    prompt: 'How do I set up UTM parameters with CM360 macros?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains how to combine UTM parameters with CM360 macros in click-through URLs',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'You can combine standard UTM parameters with CM360 macros in your click-through URLs to get dynamic, granular tracking. Here is the recommended setup:\n\n**Basic UTM + CM360 Macro Template:**\n```\nhttps://www.example.com/landing?\n  utm_source=cm360\n  &utm_medium=display\n  &utm_campaign=%ebuy!\n  &utm_content=%ecid!\n  &utm_term=%epid!\n```\n\n**What each parameter does:**\n| UTM Parameter | Value | What It Tracks |\n|---|---|---|\n| utm_source | `cm360` (static) | Traffic source — CM360 |\n| utm_medium | `display` (static) | Channel — display advertising |\n| utm_campaign | `%ebuy!` (dynamic) | Campaign ID — auto-populated |\n| utm_content | `%ecid!` (dynamic) | Creative ID — which ad version |\n| utm_term | `%epid!` (dynamic) | Placement ID — which site/slot |\n\n**How to implement:**\n1. Build the URL template with macros\n2. Set it as the click-through URL on your ads or as the landing page URL\n3. CM360 replaces the macros at serve time with actual IDs\n4. Google Analytics (or any analytics tool) picks up the UTM parameters on the landing page\n\nYou can also use `%eaid!` (ad ID) if you need ad-level granularity beyond creative and placement.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'utm_', description: 'Discusses UTM parameters' },
      { type: 'contains', value: '%epid!', description: 'Uses CM360 macros in UTM setup' },
    ],
  },
  {
    id: 'AT-008',
    prompt: 'I want the landing page URL to include the placement ID and ad ID for tracking',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Shows how to use %epid! and %eaid! in a landing page URL',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'You can include both the placement ID and ad ID in your landing page URL using CM360 macros. Here is how to structure the click-through URL:\n\n```\nhttps://www.example.com/landing?placement_id=%epid!&ad_id=%eaid!\n```\n\nAt serve time, CM360 replaces the macros with real values:\n```\nhttps://www.example.com/landing?placement_id=90050&ad_id=90120\n```\n\n**Full recommended setup with UTM parameters:**\n```\nhttps://www.example.com/landing?\n  utm_source=cm360\n  &utm_medium=display\n  &utm_campaign=%ebuy!\n  &utm_content=%ecid!\n  &placement_id=%epid!\n  &ad_id=%eaid!\n```\n\nThis gives your analytics platform everything it needs:\n- **%epid!** — Which placement (site + size) drove the click\n- **%eaid!** — Which specific ad was served\n- **%ebuy!** — Which campaign it belongs to\n- **%ecid!** — Which creative version was shown\n\n**Where to set this:** You would configure this as the click-through URL on each ad, or as the default landing page URL at the campaign level. The macros work in both the click-through URL field and any custom tracking parameters you append.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%epid!', description: 'Uses placement ID macro' },
      { type: 'contains', value: '%eaid!', description: 'Uses ad ID macro' },
      { type: 'contains', value: 'click-through', description: 'Mentions click-through URL setup' },
    ],
  },
  {
    id: 'AT-009',
    prompt: 'Set up a landing page for Apex Motors with dynamic UTM parameters using CM360 macros',
    category: 'advanced-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_landing_pages'],
    expectedBehavior: 'Looks up Apex Motors and its landing pages, then suggests a URL with macros',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90000' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I looked up **Apex Motors** (ID: 90000) and found their existing landing pages. Here is what I recommend for a landing page with dynamic UTM parameters using CM360 macros:\n\n**Recommended Landing Page URL:**\n```\nhttps://www.apexmotors.com?utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!&utm_term=%epid!\n```\n\n**What each macro does at serve time:**\n- `%ebuy!` → Replaced with the campaign ID (e.g., 90024)\n- `%ecid!` → Replaced with the creative ID\n- `%epid!` → Replaced with the placement ID\n\nWould you like me to create this as a new landing page for Apex Motors? I will set the name to something like "Apex Motors Homepage — Dynamic UTMs" so it is easy to identify.\n\nNote: You can also add `%eaid!` (ad ID) and `%eadv!` (advertiser ID) if your analytics team needs that level of detail.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%epid!', description: 'Includes placement ID macro in URL' },
      { type: 'contains', value: 'utm_', description: 'Includes UTM parameters' },
    ],
  },
  {
    id: 'AT-010',
    prompt: "What's the best practice for structuring UTMs in CM360 click-through URLs?",
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends a standard UTM structure with source, medium, campaign, content, and term',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Here is the best practice structure for UTMs in CM360 click-through URLs:\n\n**Recommended UTM Template:**\n```\n?utm_source=cm360\n&utm_medium=display\n&utm_campaign=[campaign_name_or_%ebuy!]\n&utm_content=[creative_name_or_%ecid!]\n&utm_term=[placement_name_or_%epid!]\n```\n\n**Parameter-by-parameter guidance:**\n\n| Parameter | Best Practice | Example |\n|---|---|---|\n| **utm_source** | Static: `cm360` or `dcm` | Identifies the ad server as the traffic source |\n| **utm_medium** | Static: `display`, `video`, or `programmatic` | Matches the channel type |\n| **utm_campaign** | Use a readable name OR `%ebuy!` for the campaign ID | `apex-q1-2026-awareness` or `%ebuy!` |\n| **utm_content** | Use `%ecid!` for creative-level tracking | Lets you A/B test creative performance |\n| **utm_term** | Use `%epid!` for placement-level tracking | Identifies which site/size drove the visit |\n\n**Tips:**\n1. Use lowercase and hyphens in static values — Google Analytics is case-sensitive\n2. Mix static names and dynamic macros: readable names for campaign, macros for granular IDs\n3. Keep the URL under 2,048 characters total (browser limit)\n4. Document your UTM taxonomy in a shared spreadsheet so the whole team uses the same structure\n5. Test URLs with the macros before launching — paste the URL template into a browser and verify the parameters parse correctly',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'utm_source', description: 'Covers utm_source' },
      { type: 'contains', value: 'utm_medium', description: 'Covers utm_medium' },
      { type: 'contains', value: 'utm_campaign', description: 'Covers utm_campaign' },
    ],
  },
  {
    id: 'AT-011',
    prompt: 'Can I use macros in the landing page URL or only in the click tag?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains that macros work in click-through URLs and can be set at the landing page or ad level',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 macros work in **click-through URLs** — and you can configure those at multiple levels:\n\n**Where macros are resolved:**\n1. **Landing page URL** — If you include macros in the landing page URL when creating it in CM360, they will be resolved when the user clicks through. This is the most common approach.\n2. **Ad-level click-through URL** — You can override the landing page URL at the ad level with a custom click-through URL that includes macros.\n3. **Click tag in the creative** — For HTML5 or rich media creatives, the click tag URL can include macros.\n\n**Where macros do NOT work:**\n- They do not work in impression tags (those are server-side calls that already have the data)\n- They do not work in static creative assets (like image file names)\n\n**Best practice:**\nSet your macro-enhanced URL at the **landing page level** in CM360. This way, every campaign and ad that uses that landing page automatically gets the dynamic tracking parameters. You can always override at the ad level if a specific ad needs a different URL.\n\nFor example, create a landing page with:\n```\nhttps://www.apexmotors.com?utm_source=cm360&utm_campaign=%ebuy!&utm_term=%epid!\n```\n\nThen assign it as the default landing page for the campaign. Every click-through will include the dynamic values.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'click-through', description: 'Mentions click-through URLs' },
      { type: 'contains', value: 'macro', description: 'Discusses macro placement' },
    ],
  },
  {
    id: 'AT-012',
    prompt: 'I need to track which placement drove each conversion — how do I set that up?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends using %epid! in click-through URLs for placement-level conversion tracking',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'To track which placement drove each conversion, you need to pass the placement ID through the click-through URL so your analytics or conversion tracking platform can capture it. Here is the setup:\n\n**Step 1: Add %epid! to your click-through URLs**\n```\nhttps://www.example.com/landing?utm_source=cm360&utm_medium=display&utm_term=%epid!&utm_campaign=%ebuy!\n```\n\nWhen a user clicks, `%epid!` is replaced with the actual placement ID (e.g., `90050`). Your analytics platform reads the UTM parameters on the landing page.\n\n**Step 2: Configure your analytics platform**\n- In Google Analytics: The `utm_term` parameter (carrying `%epid!`) will appear in your campaign reports under "Keyword" or custom dimensions\n- In Adobe Analytics: Map the parameter to an eVar or prop for placement-level reporting\n\n**Step 3: Set up floodlight activities (for CM360-native tracking)**\nIf you want conversion tracking directly in CM360:\n1. Create a floodlight activity on the conversion page\n2. CM360 automatically attributes conversions to placements using its own impression and click logs\n3. No additional URL parameters needed for CM360-native attribution\n\n**Best of both worlds:** Use both approaches. Floodlight gives you CM360-native attribution, and UTM parameters with `%epid!` give you the same data in your analytics platform for cross-channel analysis.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%epid!', description: 'Recommends %epid! for placement tracking' },
      { type: 'contains', value: 'tracking', description: 'Discusses conversion tracking setup' },
    ],
  },
];

// ---------------------------------------------------------------------------
// C. Adobe Analytics Integration (AT-013 to AT-018)
// ---------------------------------------------------------------------------

const adobeIntegration: TestPrompt[] = [
  {
    id: 'AT-013',
    prompt: 'How do I integrate CM360 with Adobe Analytics?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains the integration approach using ef_id and s_kwcid parameters',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Integrating CM360 with Adobe Analytics requires passing specific tracking parameters through your click-through URLs. Here is the approach:\n\n**Key Parameters:**\n1. **ef_id** — The primary parameter Adobe uses for cross-platform attribution. It carries a unique identifier that Adobe can match to CM360 ad serving data. Typically set to `%eaid!` (ad ID) so Adobe can tie each click back to the specific ad.\n\n2. **s_kwcid** — The Adobe Advertising Cloud tracking parameter. This is used by Adobe to connect display campaign data with the broader analytics suite. Format varies by implementation but often includes the campaign and placement identifiers.\n\n**Basic Integration URL Template:**\n```\nhttps://www.example.com/landing?ef_id=%eaid!:d&s_kwcid=AL!{adobe_id}!{type}!%ebuy!_%epid!\n```\n\n**Implementation Steps:**\n1. Work with your Adobe Analytics team to get the correct `s_kwcid` format for your account\n2. Add `ef_id=%eaid!:d` to all CM360 click-through URLs\n3. Add the `s_kwcid` parameter with the agreed format\n4. Set these in the landing page URL or ad-level click-through in CM360\n5. Verify in Adobe that the parameters are being captured in the correct eVars/props\n\n**Important:** The exact `s_kwcid` format depends on your Adobe Advertising Cloud configuration. Coordinate with your Adobe team to get the right template before trafficking.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ef_id', description: 'Mentions ef_id parameter' },
      { type: 'contains', value: 'Adobe', description: 'References Adobe Analytics' },
    ],
  },
  {
    id: 'AT-014',
    prompt: 'What parameters do I need for Adobe cross-platform attribution?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains ef_id with %eaid! for Adobe attribution',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'For Adobe cross-platform attribution with CM360, you need these parameters in your click-through URLs:\n\n**Required Parameters:**\n\n1. **ef_id=%eaid!:d** — This is the core attribution parameter.\n   - `ef_id` is the parameter name Adobe looks for\n   - `%eaid!` is the CM360 macro that inserts the ad ID at serve time\n   - `:d` suffix tells Adobe this is a display click (vs. `:s` for search)\n\n2. **s_kwcid** — The Adobe Advertising Cloud connector parameter\n   - Format: `AL!{account_id}!{media_type}!{campaign_id}_{placement_id}`\n   - With CM360 macros: `AL!{your_adobe_id}!d!%ebuy!_%epid!`\n\n**Full URL Example:**\n```\nhttps://www.example.com/landing?ef_id=%eaid!:d&s_kwcid=AL!9999!d!%ebuy!_%epid!\n```\n\n**How attribution works:**\n1. User clicks the ad → CM360 records the click and passes the URL with resolved macros\n2. User lands on the page → Adobe Analytics captures `ef_id` and `s_kwcid`\n3. Adobe matches the `ef_id` value back to the CM360 ad serving data\n4. Adobe can now attribute conversions to the specific CM360 ad, placement, and campaign\n\nThis enables cross-platform reporting in Adobe where you can see CM360 display performance alongside search, social, and other channels.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ef_id', description: 'Explains ef_id parameter' },
      { type: 'contains', value: '%eaid!', description: 'Uses %eaid! macro for Adobe attribution' },
    ],
  },
  {
    id: 'AT-015',
    prompt: 'Set up a click-through URL for Luminance Beauty that sends data to Adobe Analytics',
    category: 'advanced-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Looks up Luminance Beauty, then constructs an Adobe-compatible click-through URL',
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
            text: 'I found **Luminance Beauty** (ID: 90001). Here is a click-through URL configured for Adobe Analytics integration:\n\n**Recommended Click-Through URL:**\n```\nhttps://www.luminancebeauty.com?ef_id=%eaid!:d&s_kwcid=AL!{your_adobe_id}!d!%ebuy!_%epid!&utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!\n```\n\n**Parameter breakdown:**\n| Parameter | Value | Purpose |\n|---|---|---|\n| ef_id | `%eaid!:d` | Adobe primary attribution (ad ID + display flag) |\n| s_kwcid | `AL!{id}!d!%ebuy!_%epid!` | Adobe Advertising Cloud connector |\n| utm_source | `cm360` | Traffic source for GA/backup analytics |\n| utm_medium | `display` | Channel type |\n| utm_campaign | `%ebuy!` | Campaign ID |\n| utm_content | `%ecid!` | Creative ID |\n\n**Next steps:**\n1. Replace `{your_adobe_id}` with Luminance Beauty\'s actual Adobe Advertising Cloud account ID (your Adobe team will have this)\n2. I can create this as a new landing page for Luminance Beauty, or update an existing one\n3. Then assign it to the relevant campaigns\n\nWould you like me to create this landing page?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'ef_id', description: 'Includes ef_id parameter' },
      { type: 'contains', value: 'Adobe', description: 'References Adobe Analytics' },
    ],
  },
  {
    id: 'AT-016',
    prompt: 'Where should I put the Adobe tracking parameters — in the impression tag or click-through URL?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends click-through URL for Adobe tracking parameters, not impression tags',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Put the Adobe tracking parameters in the **click-through URL**, not the serving tag.\n\nHere is why:\n\n**Click-through URL (correct placement):**\n- `ef_id` and `s_kwcid` are designed to be captured by Adobe Analytics on the landing page\n- They work by being present in the URL when the user arrives at the advertiser\'s site\n- Adobe\'s JavaScript on the landing page reads these parameters and stores them for attribution\n- This is where CM360 macros like `%eaid!` and `%epid!` get resolved\n\n**Tracking pixel (wrong placement for Adobe params):**\n- Tracking pixels fire server-to-server when the ad loads — the user never visits a landing page\n- Adobe\'s landing page JavaScript would never see parameters in a tracking pixel\n- Tracking pixels are for recording that the ad was served, not for passing click attribution data\n\n**Setup:**\n```\nClick-through URL: https://example.com?ef_id=%eaid!:d&s_kwcid=AL!9999!d!%ebuy!_%epid!\n```\n\nSet this as the landing page URL in CM360 or as the ad-level click-through override. Adobe will capture the parameters when the user lands on the page after clicking.\n\n**One exception:** If you are using Adobe\'s server-side tracking (AMO ID integration), there is a separate CM360-to-Adobe data feed that handles impression-level data. But that is configured at the platform level, not in individual tags.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'click-through', description: 'Recommends click-through URL' },
      { type: 'not_contains', value: 'impression tag', description: 'Does not recommend impression tag as the place for Adobe params' },
    ],
  },
  {
    id: 'AT-017',
    prompt: 'Explain how the s_kwcid parameter works with CM360',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains s_kwcid as the Adobe Advertising Cloud connector parameter',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'The **s_kwcid** parameter is Adobe Advertising Cloud\'s tracking connector — it ties CM360 ad serving data to your Adobe Analytics suite.\n\n**What it does:**\n- When a user clicks a CM360 ad, the `s_kwcid` value lands on the page URL\n- Adobe Analytics JavaScript reads it and stores it in a reserved eVar\n- Adobe uses it to connect the click to its broader attribution model\n- This enables cross-channel reporting: you can see CM360 display performance alongside search, social, and direct traffic in Adobe\n\n**Format:**\n```\ns_kwcid=AL!{account_id}!{media_type}!{campaign_id}_{additional_ids}\n```\n\n- `AL` — Adobe marker prefix\n- `{account_id}` — Your Adobe Advertising Cloud account ID\n- `{media_type}` — `d` for display, `s` for search\n- `{campaign_id}_{additional_ids}` — CM360 identifiers (use macros)\n\n**With CM360 macros:**\n```\ns_kwcid=AL!9999!d!%ebuy!_%epid!\n```\n\n**How it works in the Adobe suite:**\n1. User clicks ad → lands on page with `s_kwcid` in the URL\n2. Adobe Analytics captures the value automatically (no custom code needed if AMO integration is enabled)\n3. Adobe attributes the visit and any downstream conversions to the CM360 campaign/placement\n4. Data appears in Adobe Analytics under Advertising Analytics reports\n\nThe exact format of `s_kwcid` varies by Adobe implementation. Always confirm with your Adobe team before trafficking.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 's_kwcid', description: 'Explains the s_kwcid parameter' },
      { type: 'contains', value: 'Adobe', description: 'Connects it to the Adobe suite' },
    ],
  },
  {
    id: 'AT-018',
    prompt: "I'm seeing discrepancies between CM360 and Adobe reporting — what could cause that?",
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains common causes of reporting discrepancies between the two platforms',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Discrepancies between CM360 and Adobe reporting are extremely common — and usually explainable. Here are the most frequent causes:\n\n**1. Attribution model differences**\n- CM360 uses last-click or last-impression attribution by default\n- Adobe may use a different attribution model (first-touch, linear, time-decay)\n- The same conversion can be credited differently depending on the model\n\n**2. Click counting methodology**\n- CM360 counts a click when the user clicks the ad (server-side)\n- Adobe counts a click when the landing page JavaScript fires (client-side)\n- If the user clicks but the page does not fully load, CM360 counts it but Adobe does not\n- This typically causes CM360 to show 5-15% more clicks than Adobe\n\n**3. Impression tracking differences**\n- CM360 counts an impression when the ad tag fires\n- Adobe only sees impressions if a separate impression pixel is implemented\n- Without explicit impression tracking, Adobe has no impression data to compare\n\n**4. Cookie/tracking discrepancies**\n- CM360 uses its own cookie space (DoubleClick cookies)\n- Adobe uses its own cookie space (s_vi, AMCV)\n- Cross-device users may be counted differently by each platform\n- Ad blockers or ITP (Safari) can affect one platform more than the other\n\n**5. Parameter loss**\n- If `ef_id` or `s_kwcid` parameters are stripped by redirects, URL shorteners, or the landing page itself, Adobe loses the attribution link\n- Always test the full click path end-to-end\n\n**How to diagnose:** Start by comparing click counts for a single day on a single placement. If the numbers diverge, work through the causes above one by one.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'attribution', description: 'Mentions attribution model differences' },
      { type: 'contains', value: 'click', description: 'Discusses click counting discrepancies' },
    ],
  },
];

// ---------------------------------------------------------------------------
// D. Demandbase / B2B Integration (AT-019 to AT-022)
// ---------------------------------------------------------------------------

const demandbaseIntegration: TestPrompt[] = [
  {
    id: 'AT-019',
    prompt: 'How does Demandbase work with CM360?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains Demandbase as a B2B targeting/ABM platform that integrates with DV360 and CM360',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Demandbase is an account-based marketing (ABM) platform that enables B2B targeting in digital advertising. Here is how it integrates with the CM360 ecosystem:\n\n**How the integration works:**\n1. **Demandbase identifies companies** — Using IP-to-company mapping, cookie data, and intent signals, Demandbase identifies which companies are visiting your site or showing buying intent\n2. **Demandbase creates audience segments** — Target lists of specific companies (e.g., "Fortune 500 tech companies showing intent for cybersecurity solutions")\n3. **Audiences are pushed to DV360** — Demandbase syncs its audience segments as targeting lists in Display & Video 360 (Google\'s DSP)\n4. **DV360 buys the media** — DV360 uses the Demandbase audience for programmatic targeting, buying impressions only when the user matches the target company list\n5. **CM360 serves and tracks** — The ads are served through CM360 tags, giving you unified reporting\n\n**Key point:** Demandbase does not integrate directly with CM360 for targeting. The targeting happens in DV360 (the buying platform), and CM360 handles the ad serving and tracking. CM360\'s role is to traffic the placements, serve the creatives, and report on delivery.\n\n**What you do in CM360:**\n- Create campaigns and placements as normal\n- Set up click-through URLs with tracking parameters\n- Generate tags for the DV360-targeted placements\n\nThe Demandbase ABM targeting is invisible to CM360 — it just sees normal impression and click data.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Demandbase', description: 'Explains Demandbase' },
      { type: 'contains', value: 'ABM', description: 'Mentions account-based marketing' },
    ],
  },
  {
    id: 'AT-020',
    prompt: 'I need to set up a Demandbase-targeted campaign for NovaTech',
    category: 'advanced-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Looks up NovaTech, then explains the Demandbase campaign workflow',
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
            text: 'I found **NovaTech Solutions** (ID: 90003). Here is how to set up a Demandbase-targeted campaign:\n\n**Workflow Overview:**\n\n**Step 1: Demandbase setup (outside CM360)**\n- Define your target account list in Demandbase (e.g., Fortune 500 tech companies)\n- Demandbase creates audience segments based on IP mapping and intent data\n- Sync those audience segments to DV360 as targeting lists\n\n**Step 2: DV360 setup (the buying platform, also called the DSP)**\n- Create a DV360 campaign targeting the Demandbase audience lists\n- Set bid strategy, budget, and frequency caps\n- DV360 handles the programmatic buying with Demandbase targeting applied\n\n**Step 3: CM360 setup (what I can help with)**\n- Create a campaign for NovaTech Solutions in CM360 (e.g., "NovaTech Q2 2026 ABM Display")\n- Create placements for the sites where DV360 will buy inventory\n- Set up click-through URLs with tracking parameters for attribution\n- Generate tags — these will be used by DV360 for ad serving\n\n**What I can do right now:**\nI can help with Step 3 — creating the CM360 campaign, placements, and tags. Want me to set up the campaign? I will need:\n- Campaign name and dates\n- Which sites and sizes to create placements for\n- Whether you want dynamic UTM macros in the landing page URL',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Demandbase', description: 'Explains the Demandbase workflow' },
      { type: 'contains', value: 'audience', description: 'Discusses audience targeting' },
      { type: 'contains', value: 'DV360', description: 'Explains DV360 role in the workflow' },
    ],
  },
  {
    id: 'AT-021',
    prompt: 'Can I target by company name in CM360?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains that CM360 does not do company targeting — need Demandbase or third-party data',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 does not support targeting by company name natively. CM360 is an ad serving and trafficking platform — it delivers ads and tracks them, but it does not handle audience targeting or media buying.\n\nTo target by company name, you need a **third-party B2B targeting platform** like:\n\n1. **Demandbase** — The most common B2B ABM platform. It maps IP addresses to company names and creates targetable audience segments.\n2. **6sense** — Similar ABM platform with intent data and account identification.\n3. **LinkedIn Audience Network** — Can target by company name, job title, industry (but uses its own ad serving, not CM360).\n4. **Bombora** — B2B intent data that can be activated through DV360.\n\n**How it works with CM360:**\n- The targeting happens in the **DSP (DV360)** or the third-party platform\n- The audience segments are applied at the media buying level\n- CM360 serves the ads and tracks delivery — but it does not know or care about the company-level targeting\n- CM360 just sees "this placement got an impression" — it does not see "this impression was served to a Fortune 500 company"\n\nIf you need company-level reporting alongside your CM360 data, Demandbase can provide that through its own analytics dashboard, which you can cross-reference with CM360 placement-level reporting.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Demandbase', description: 'Recommends Demandbase for company targeting' },
      { type: 'not_contains', value: 'cm360_create', description: 'Does not try to create anything in CM360' },
    ],
  },
  {
    id: 'AT-022',
    prompt: 'How do I pass Demandbase company data into my click-through URLs?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains using key-value parameters or macros in click-through URLs for Demandbase data',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Passing Demandbase company data into click-through URLs requires a combination of CM360 macros and Demandbase\'s own key-value targeting. Here is how it works:\n\n**Approach 1: CM360 Key-Value Macros**\nIf your DV360 campaign passes Demandbase data as key-value pairs, you can capture those in the click-through URL using CM360\'s key-value macro syntax:\n```\nhttps://www.example.com/landing?db_company=%ekey[db_company]!&db_industry=%ekey[db_industry]!\n```\n\n**Approach 2: Demandbase Tag on Landing Page**\nMore commonly, Demandbase data is captured on the landing page itself:\n1. Install the Demandbase JavaScript tag on your landing page\n2. When a user arrives, Demandbase identifies the company in real-time\n3. Demandbase populates company name, industry, and other firmographic data\n4. Your analytics platform (Adobe, GA) captures this alongside the CM360 UTM parameters\n\n**Recommended Combined URL:**\n```\nhttps://www.example.com/landing?utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_term=%epid!&channel=demandbase-abm\n```\n\nThe `channel=demandbase-abm` is a static parameter that tells your analytics team this traffic came from a Demandbase-targeted campaign. The actual company identification happens client-side via the Demandbase tag.\n\n**Best practice:** Do not try to pass company names in the click-through URL — that creates messy, unreliable data. Let Demandbase identify the company on the landing page where it has full access to its IP and cookie data.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'key-value', description: 'Discusses key-value parameters' },
      { type: 'contains', value: 'click-through', description: 'Explains click-through URL setup' },
    ],
  },
];

// ---------------------------------------------------------------------------
// E. Verification Vendors & Complex Workflows (AT-023 to AT-026)
// ---------------------------------------------------------------------------

const verificationVendors: TestPrompt[] = [
  {
    id: 'AT-023',
    prompt: 'How do I add DoubleVerify verification to my placements?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains DoubleVerify integration via event tags in CM360',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'DoubleVerify (DV) verification is added to CM360 placements through **event tags**. Here is how to set it up:\n\n**What is an event tag?**\nAn event tag is a third-party tracking pixel that fires alongside your CM360 ad serving tag. It runs in the background — the user does not see it — and sends data to a third-party vendor like DoubleVerify.\n\n**Setup Steps:**\n\n1. **Get the DV tag from DoubleVerify**\n   - Your DoubleVerify account manager provides a JavaScript verification tag\n   - It looks something like: `<script src="https://cdn.doubleverify.com/dvtp_src.js?ctx=..."></script>`\n\n2. **Create an event tag in CM360**\n   - Go to the campaign or advertiser level\n   - Create a new event tag with Type: "Impression verification"\n   - Paste the DoubleVerify tag code\n   - Set it to fire on impressions (and optionally on clicks)\n\n3. **Assign the event tag to placements**\n   - Apply the event tag to all placements that need DV verification\n   - You can assign at the campaign level (applies to all placements) or per-placement\n\n4. **Verify it is working**\n   - After trafficking, check the DoubleVerify dashboard to confirm impressions are being received\n   - Compare DV impression counts with CM360 — they should be close (within 2-5% is normal)\n\n**Important:** Event tags add a small amount of latency to ad loading. DoubleVerify is generally very fast, but keep this in mind for performance-sensitive placements.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'DoubleVerify', description: 'Explains DoubleVerify integration' },
      { type: 'contains', value: 'event tag', description: 'Recommends event tags for verification' },
    ],
  },
  {
    id: 'AT-024',
    prompt: "What's the difference between event tags and ad serving tags in CM360?",
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains that ad serving tags serve the actual ad while event tags fire alongside for third-party tracking',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'These serve fundamentally different purposes in CM360:\n\n**Ad Serving Tags:**\n- These are the primary tags that actually **display the ad** on the publisher\'s site\n- Generated by CM360 for each placement\n- The publisher implements them on their website\n- They call CM360\'s ad server, which returns the creative (image, HTML5, video)\n- One tag per placement — this is the tag you send to the publisher\n- Example: `<script src="https://ad.doubleclick.net/ddm/trackimp/..."></script>`\n\n**Event Tags:**\n- These are secondary tags that fire **alongside** the ad serving tag\n- They send data to third-party vendors (DoubleVerify, IAS, MOAT, Nielsen, etc.)\n- They do NOT display anything — they are invisible tracking pixels\n- Used for verification, viewability, brand safety, and audience measurement\n- Multiple event tags can be attached to a single placement\n- They fire on specific events: impression, click, or both\n\n**Relationship:**\n```\nAd Serving Tag (primary — serves the creative)\n  ├── Event Tag 1: DoubleVerify verification (fires on impression)\n  ├── Event Tag 2: IAS viewability (fires on impression)\n  └── Event Tag 3: Nielsen audience measurement (fires on impression)\n```\n\n**Key difference:** Ad serving tags are what publishers implement. Event tags are configured in CM360 and fire automatically — the publisher never sees them.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'event tag', description: 'Explains event tags' },
      { type: 'contains', value: 'ad serving', description: 'Explains ad serving tags' },
    ],
  },
  {
    id: 'AT-025',
    prompt: 'I need brand safety monitoring on the Meridian Financial campaign',
    category: 'advanced-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns'],
    expectedBehavior: 'Looks up Meridian Financial campaigns, then recommends verification vendor setup',
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
            text: 'I found **Meridian Financial** (ID: 90002) and their campaigns. Here is how to set up brand safety monitoring:\n\n**Meridian Financial Campaigns:**\n- Meridian Q1 2026 campaigns (multiple active)\n\n**Brand safety setup using verification vendors:**\n\nFor a financial services advertiser like Meridian Financial, brand safety is critical. You want to ensure ads do not appear next to controversial, misleading, or inappropriate content. Here is the recommended approach:\n\n**Option 1: DoubleVerify (DV)**\n- Industry standard for brand safety\n- Create event tags with DV\'s verification JavaScript\n- Apply to all Meridian Financial campaign placements\n- DV monitors each impression for content adjacency and flags violations\n\n**Option 2: IAS (Integral Ad Science)**\n- Another top-tier verification vendor\n- Similar event tag setup process\n- Provides brand safety scores and category-level blocking\n\n**Implementation in CM360:**\n1. Get the verification tag from your DoubleVerify or IAS account rep\n2. Create an event tag in CM360 at the Meridian Financial advertiser level\n3. Set the event tag to fire on impressions\n4. Assign it to all Meridian Financial campaigns\n5. Monitor the verification dashboard for brand safety incidents\n\n**For financial services specifically:** I recommend configuring DV or IAS to flag content related to fraud, financial scams, controversial politics, and misinformation — these are the highest-risk categories for financial advertisers.\n\nWould you like me to walk you through creating the event tags?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'brand safety', description: 'Discusses brand safety' },
      { type: 'contains', value: 'verification', description: 'Recommends verification vendor setup' },
    ],
  },
  {
    id: 'AT-026',
    prompt: 'How do I set up IAS viewability tracking alongside my CM360 tags?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains IAS viewability tracking via event tags in CM360',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'IAS (Integral Ad Science) viewability tracking is set up through **event tags** in CM360, similar to DoubleVerify. Here is the step-by-step process:\n\n**What IAS viewability measures:**\n- Whether the ad was actually viewable to the user (MRC standard: 50% of pixels in view for 1+ second for display, 2+ seconds for video)\n- Time-in-view metrics\n- Above-the-fold vs. below-the-fold delivery\n- Fraud detection (invalid traffic, bots)\n\n**Setup Steps:**\n\n1. **Get your IAS tracking tag**\n   - Your IAS account manager provides a JavaScript pixel\n   - Typically formatted as: `<script src="https://pixel.adsafeprotected.com/rjss/st/..."></script>`\n\n2. **Create an event tag in CM360**\n   - Navigate to the campaign or advertiser level\n   - Create a new event tag\n   - Set Type: "Impression verification" or "Third-party"\n   - Paste the IAS tag code\n   - Configure to fire on **impressions** (viewability needs to fire at impression time)\n\n3. **Assign to placements**\n   - Apply the event tag at the campaign level (recommended — covers all placements automatically)\n   - Or assign to specific placements if only some need IAS tracking\n\n4. **Running alongside CM360 tags**\n   - IAS event tags fire in parallel with the CM360 ad serving tag\n   - They do not interfere with ad delivery or click tracking\n   - Multiple event tags can run simultaneously (e.g., IAS for viewability + DV for brand safety)\n\n5. **Verify in IAS dashboard**\n   - After go-live, check the IAS dashboard to confirm impressions are flowing\n   - Compare IAS impression counts with CM360 — expect 2-5% variance (normal for third-party tracking)\n\n**Performance note:** Adding event tags introduces a small latency hit (typically 10-50ms). For most placements this is negligible, but for high-performance programmatic buys, consider testing the impact.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'IAS', description: 'Explains IAS integration' },
      { type: 'contains', value: 'viewability', description: 'Discusses viewability tracking' },
      { type: 'contains', value: 'event tag', description: 'Recommends event tags' },
    ],
  },
];

// ---------------------------------------------------------------------------
// F. Complex Data Workflow Recommendations (AT-027 to AT-030)
// ---------------------------------------------------------------------------

const complexWorkflows: TestPrompt[] = [
  {
    id: 'AT-027',
    prompt: 'I need to set up a data workflow where CM360 impression and click data flows into Adobe Analytics for a Demandbase-targeted campaign',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains the full data flow: Demandbase targeting in DV360, CM360 ad serving with Adobe parameters, and landing page capture',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Here is the full data workflow connecting Demandbase targeting, CM360 ad serving, and Adobe Analytics:\n\n**Architecture:**\n```\nDemandbase (targeting) → DV360 (buying) → CM360 (serving) → Landing Page → Adobe Analytics\n```\n\n**Step-by-step setup:**\n\n**1. Demandbase → DV360**\n- Define target account lists in Demandbase\n- Sync audience segments to DV360 as targeting lists\n- DV360 uses these audiences for programmatic buying\n\n**2. CM360 ad serving setup**\n- Create campaign and placements in CM360\n- Configure click-through URLs with both Adobe and UTM parameters:\n```\nhttps://www.example.com/landing?\n  ef_id=%eaid!:d\n  &s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!\n  &utm_source=cm360\n  &utm_medium=display\n  &utm_campaign=%ebuy!\n  &utm_term=%epid!\n  &channel=demandbase-abm\n```\n\n**3. Landing page setup**\n- Install the Demandbase tag on your landing page (for company identification)\n- Ensure Adobe Analytics JavaScript is installed and configured to capture `ef_id` and `s_kwcid`\n- The UTM macro parameters will be resolved by CM360 at click time\n\n**4. Adobe Analytics data flow**\n- Clicks arrive with `ef_id` and `s_kwcid` → Adobe attributes to CM360\n- Demandbase tag fires → Adobe captures company name, industry, revenue (via data connector)\n- You now have placement-level CM360 data + company-level Demandbase data in one Adobe report\n\n**5. Impression data**\n- For impression-level data in Adobe, you need the CM360-to-Adobe server-side data feed (AMO integration)\n- This syncs impression and click logs directly from CM360 to Adobe without relying on landing page parameters\n\nThis gives you a complete view: which companies (Demandbase) saw which ads (CM360) and what they did on your site (Adobe).',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'Adobe', description: 'Covers Adobe Analytics' },
      { type: 'contains', value: 'Demandbase', description: 'Covers Demandbase targeting' },
      { type: 'contains', value: 'utm', description: 'Includes UTM/macro setup' },
    ],
  },
  {
    id: 'AT-028',
    prompt: 'What URL parameters should I include for complete attribution tracking across CM360, Adobe, and Google Analytics?',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Provides a comprehensive URL template with UTM, ef_id, s_kwcid, and CM360 macros',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'For complete attribution tracking across CM360, Adobe Analytics, and Google Analytics, here is the comprehensive URL parameter set:\n\n**Full Click-Through URL Template:**\n```\nhttps://www.example.com/landing?\n  utm_source=cm360\n  &utm_medium=display\n  &utm_campaign=%ebuy!\n  &utm_content=%ecid!\n  &utm_term=%epid!\n  &ef_id=%eaid!:d\n  &s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!\n  &gclsrc=ds\n```\n\n**Parameter-by-parameter breakdown:**\n\n| Parameter | Value | Used By | Purpose |\n|---|---|---|---|\n| utm_source | `cm360` | Google Analytics | Identifies traffic source |\n| utm_medium | `display` | Google Analytics | Identifies channel |\n| utm_campaign | `%ebuy!` | Google Analytics | Campaign ID (dynamic) |\n| utm_content | `%ecid!` | Google Analytics | Creative ID (dynamic) |\n| utm_term | `%epid!` | Google Analytics | Placement ID (dynamic) |\n| ef_id | `%eaid!:d` | Adobe Analytics | Primary attribution ID |\n| s_kwcid | `AL!{id}!d!%ebuy!_%epid!` | Adobe Advertising Cloud | Cross-platform connector |\n| gclsrc | `ds` | Google Campaign Manager | Marks traffic from DCM/CM360 |\n\n**What each platform sees:**\n- **Google Analytics:** Full UTM suite with dynamic campaign, creative, and placement IDs\n- **Adobe Analytics:** `ef_id` for attribution + `s_kwcid` for Advertising Cloud integration\n- **CM360:** Native click and impression tracking (automatic, no URL parameters needed)\n\n**Tips:**\n1. Keep the URL under 2,048 characters\n2. URL-encode any special characters in static values\n3. Test the full URL before trafficking — paste it in a browser to verify parameters parse correctly\n4. Document the taxonomy in a shared spreadsheet so the team is consistent',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'utm_', description: 'Includes UTM parameters' },
      { type: 'contains', value: 'ef_id', description: 'Includes Adobe ef_id' },
      { type: 'contains', value: '%epid!', description: 'Uses CM360 macros' },
    ],
  },
  {
    id: 'AT-029',
    prompt: "I'm setting up Vanguard Athletics placements and need macros for their attribution model — they use Adobe Analytics and want placement-level reporting",
    category: 'advanced-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers'],
    expectedBehavior: 'Looks up Vanguard Athletics, then recommends placement-level macros for Adobe',
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
          {
            type: 'text',
            text: 'I found **Vanguard Athletics** (ID: 90004). Since they use Adobe Analytics and want placement-level reporting, here is the recommended setup:\n\n**Click-Through URL for Vanguard Athletics Placements:**\n```\nhttps://www.vanguardathletics.com/landing?\n  ef_id=%eaid!:d\n  &s_kwcid=AL!{vanguard_adobe_id}!d!%ebuy!_%epid!\n  &utm_source=cm360\n  &utm_medium=display\n  &utm_campaign=%ebuy!\n  &utm_content=%ecid!\n  &placement=%epid!\n```\n\n**Why %epid! is the key macro here:**\nThe `%epid!` macro gives you placement-level granularity. Each placement maps to a specific site + size combination (e.g., ESPN 300x250 vs. Forbes 728x90). By including `%epid!` in both the Adobe parameters and the UTM parameters, your analytics team can:\n\n1. **In Adobe Analytics:** See which placement drove each visit and conversion via the `s_kwcid` parameter (which includes `%epid!`)\n2. **In Google Analytics:** See placement-level data in the utm_term reports\n3. **In CM360:** Cross-reference placement IDs with their campaign reporting\n\n**Adobe-Specific Setup:**\n- Map the `ef_id` parameter to an eVar in Adobe (your Adobe admin does this)\n- The `s_kwcid` with `%epid!` gives Adobe the placement ID for its attribution model\n- Adobe can then break down conversions by placement within the CM360 campaign\n\n**Next steps:** Once you confirm the Adobe account ID for Vanguard Athletics, I can help create the landing page with this URL structure and assign it to their campaigns.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '%epid!', description: 'Recommends %epid! for placement-level tracking' },
      { type: 'contains', value: 'Adobe', description: 'Covers Adobe Analytics setup' },
      { type: 'contains', value: 'placement', description: 'Focuses on placement-level reporting' },
    ],
  },
  {
    id: 'AT-030',
    prompt: 'Explain the full lifecycle of an ad impression in CM360 — from serving to click-through to landing page to conversion tracking',
    category: 'advanced-trafficking',
    expectedTools: [],
    expectedBehavior: 'Walks through the complete lifecycle: tag fires, impression recorded, click redirect, landing page, conversion',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Here is the full lifecycle of an ad impression in CM360, from the first millisecond to the final conversion:\n\n**1. Ad Tag Fires (Impression)**\n- A user visits a publisher\'s page (e.g., ESPN.com)\n- The CM360 ad serving tag embedded on the page executes\n- The tag sends a request to `ad.doubleclick.net` with the placement ID\n- CM360\'s ad server checks: Is the placement active? Which ad is assigned? Which creative should serve?\n- CM360 returns the creative asset (banner image, HTML5, or VAST video)\n- The ad renders in the user\'s browser\n- An **impression pixel** fires back to CM360, recording the impression with timestamp, placement ID, ad ID, creative ID, and user data\n\n**2. Event Tags Fire (Verification)**\n- Alongside the impression, any attached event tags fire in parallel\n- DoubleVerify, IAS, or other vendors receive their verification call\n- They measure viewability, brand safety, and fraud\n\n**3. User Clicks (Click-Through)**\n- The user clicks the ad\n- The click goes through CM360\'s click tracker: `ad.doubleclick.net/ddm/trackclk/...`\n- CM360 records the click with all associated metadata\n- CM360 resolves all macros in the click-through URL: `%epid!` → `90050`, `%eaid!` → `90120`, etc.\n- CM360 redirects the user to the landing page with the fully resolved URL\n\n**4. Landing Page Load**\n- The user arrives at the landing page: `https://www.example.com?utm_source=cm360&utm_campaign=90024&placement=90050`\n- Google Analytics reads the UTM parameters\n- Adobe Analytics reads `ef_id` and `s_kwcid`\n- Demandbase tag (if present) identifies the user\'s company\n- All analytics tags fire and record the visit\n\n**5. Conversion (if it happens)**\n- The user completes a desired action (purchase, form fill, sign-up)\n- A **floodlight tag** on the conversion page fires back to CM360\n- CM360 matches the conversion to the original impression and click using its cookie data\n- CM360 records the conversion and attributes it to the campaign, placement, and ad\n- Adobe and Google Analytics also record the conversion through their own tracking\n\n**Timeline:** Steps 1-3 happen in milliseconds. Step 4 is seconds. Step 5 can be minutes, hours, or days later (CM360\'s default attribution window is 30 days for clicks, 7 days for impressions).',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'impression', description: 'Covers the impression step' },
      { type: 'contains', value: 'click', description: 'Covers the click step' },
      { type: 'contains', value: 'landing page', description: 'Covers the landing page step' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Export all advanced trafficking prompts
// ---------------------------------------------------------------------------

export const ADVANCED_TRAFFICKING_PROMPTS: TestPrompt[] = [
  ...cm360MacrosBasic,
  ...utmInjection,
  ...adobeIntegration,
  ...demandbaseIntegration,
  ...verificationVendors,
  ...complexWorkflows,
];
