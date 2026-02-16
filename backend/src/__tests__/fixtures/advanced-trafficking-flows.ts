/**
 * Advanced trafficking multi-turn conversation flows (5 flows, 19 turns total).
 *
 * These test that Kiki can maintain context across turns while handling
 * complex third-party integrations (Adobe Analytics, Demandbase),
 * CM360 macro injection, verification vendor setup, and multi-tool
 * data workflows.
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
// FLOW-AT-001: Adobe Integration Setup (4 turns)
// User sets up Adobe Analytics tracking for Apex Motors campaigns
// ---------------------------------------------------------------------------

const adobeIntegrationSetup: ConversationFlow = {
  id: 'FLOW-AT-001',
  name: 'Adobe Integration Setup',
  description:
    'User sets up Adobe Analytics tracking for Apex Motors — looks up advertiser, gets parameter recommendations, builds full URL, adds placement-level granularity',
  turns: [
    {
      userMessage: 'I need to set up Adobe Analytics tracking for the Apex Motors campaigns',
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
            {
              type: 'text',
              text: 'I found **Apex Motors** (ID: 90000). To set up Adobe Analytics tracking for their campaigns, we will need to add specific parameters to the click-through URLs.\n\nHere is what we need to do:\n\n1. **Add the ef_id parameter** — This is Adobe\'s primary attribution identifier. It tells Adobe which CM360 ad generated the click.\n2. **Add the s_kwcid parameter** — This is the Adobe Advertising Cloud connector that links CM360 data to your Adobe suite.\n3. **Optionally add UTM parameters** — For Google Analytics as a backup/secondary analytics platform.\n\nBefore I build the URL, I have one question: do you have the Adobe Advertising Cloud account ID for Apex Motors? I will need it for the `s_kwcid` parameter format.\n\nIn the meantime, let me explain the key parameters you will need.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Apex Motors',
          description: 'Identifies the correct advertiser',
        },
        {
          type: 'contains',
          value: 'ef_id',
          description: 'Mentions the ef_id parameter',
        },
        {
          type: 'contains',
          value: 'Adobe',
          description: 'References Adobe Analytics',
        },
      ],
      description: 'Turn 1: Looks up Apex Motors and outlines what is needed for Adobe integration',
    },
    {
      userMessage: 'What parameters do I need in the click-through URL?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here are the parameters you need in the click-through URL for Adobe Analytics tracking:\n\n**Required for Adobe:**\n\n1. **ef_id=%eaid!:d** — The primary Adobe attribution parameter\n   - `ef_id` is the parameter name Adobe looks for\n   - `%eaid!` is a CM360 macro that inserts the ad ID at serve time\n   - `:d` tells Adobe this is a display click (vs. `:s` for search)\n\n2. **s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!** — Adobe Advertising Cloud connector\n   - `AL` is the Adobe marker prefix\n   - `{adobe_id}` is your Adobe account ID (replace with the real value)\n   - `d` means display\n   - `%ebuy!` inserts the campaign ID\n   - `%epid!` inserts the placement ID\n\n**Recommended additions for Google Analytics:**\n- `utm_source=cm360`\n- `utm_medium=display`\n- `utm_campaign=%ebuy!`\n- `utm_content=%ecid!`\n\nWant me to show you the full URL assembled together?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'ef_id',
          description: 'Explains the ef_id parameter',
        },
        {
          type: 'contains',
          value: 's_kwcid',
          description: 'Explains the s_kwcid parameter',
        },
        {
          type: 'contains',
          value: '%eaid!',
          description: 'Recommends the ad ID macro',
        },
      ],
      description: 'Turn 2: Lists the required Adobe parameters with CM360 macros',
    },
    {
      userMessage: 'Can you show me what the full URL would look like?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here is the complete click-through URL for Apex Motors with all Adobe Analytics and UTM parameters:\n\n```\nhttps://www.apexmotors.com?ef_id=%eaid!:d&s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!&utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!\n```\n\n**What happens at serve time:**\nWhen a user clicks the ad, CM360 resolves all the macros. For example, an ad in the Q1 Display Awareness campaign on ESPN might produce:\n```\nhttps://www.apexmotors.com?ef_id=90120:d&s_kwcid=AL!{adobe_id}!d!90024_90050&utm_source=cm360&utm_medium=display&utm_campaign=90024&utm_content=90100\n```\n\n**Each resolved value:**\n- `%eaid!` → `90120` (the ad ID)\n- `%ebuy!` → `90024` (the campaign ID)\n- `%epid!` → `90050` (the placement ID)\n- `%ecid!` → `90100` (the creative ID)\n\nJust replace `{adobe_id}` with the actual Adobe Advertising Cloud account ID and you are ready to set this as the landing page URL in CM360.\n\nWant me to create this as a new landing page for Apex Motors?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'ef_id',
          description: 'Full URL includes ef_id',
        },
        {
          type: 'contains',
          value: '%eaid!',
          description: 'Full URL includes ad ID macro',
        },
        {
          type: 'contains',
          value: 'apexmotors',
          description: 'URL uses the Apex Motors domain',
        },
      ],
      description: 'Turn 3: Constructs the full click-through URL with all parameters',
    },
    {
      userMessage: 'Got it. Let me also add the placement ID for granular reporting',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'The placement ID is already included via the `%epid!` macro — it appears in two places in the URL:\n\n1. **In the s_kwcid parameter:** `...!d!%ebuy!_%epid!` — Adobe uses this for its attribution model\n2. **In the utm_term parameter** (if we add it): `utm_term=%epid!` — Google Analytics uses this\n\nHere is the updated URL with an explicit `placement` parameter and `utm_term` for maximum granularity:\n\n```\nhttps://www.apexmotors.com?ef_id=%eaid!:d&s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!&utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!&utm_term=%epid!&placement=%epid!\n```\n\nNow `%epid!` appears three times:\n- `s_kwcid` — for Adobe Advertising Cloud\n- `utm_term` — for Google Analytics\n- `placement` — as a standalone parameter your analytics team can use directly\n\nThis gives you placement-level reporting in all three platforms: CM360 (native), Adobe Analytics, and Google Analytics.\n\nWant me to create this as a landing page for Apex Motors and assign it to their campaigns?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: '%epid!',
          description: 'Confirms the placement ID macro is included',
        },
        {
          type: 'contains',
          value: 'placement',
          description: 'Adds explicit placement parameter',
        },
        {
          type: 'contains',
          value: 'granularity',
          description: 'Discusses the granular reporting benefit',
        },
      ],
      description: 'Turn 4: Confirms %epid! is already present, adds explicit placement parameter for additional granularity',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-AT-002: UTM Macro Injection (3 turns)
// User adds dynamic UTMs to Luminance Beauty landing pages
// ---------------------------------------------------------------------------

const utmMacroInjection: ConversationFlow = {
  id: 'FLOW-AT-002',
  name: 'UTM Macro Injection',
  description:
    'User adds dynamic UTM parameters to Luminance Beauty landing pages using CM360 macros, then asks about cache busting',
  turns: [
    {
      userMessage: 'I want to add dynamic UTMs to all Luminance Beauty landing pages',
      mockResponses: [
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
            { type: 'tool_use', id: 'tu_3', name: 'cm360_list_landing_pages', input: { profileId: '12345', advertiserId: '90001' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'I found **Luminance Beauty** (ID: 90001) and their existing landing pages. To add dynamic UTM parameters, we will use CM360 macros that get replaced with real values at serve time.\n\nHere is what I need from you to build the URL template:\n1. **utm_source** — what value? (e.g., `cm360`, `dcm`)\n2. **utm_medium** — what value? (e.g., `display`, `video`)\n3. **utm_campaign** — static name or dynamic `%ebuy!` (campaign ID)?\n\nFor utm_content and utm_term, I would recommend using the CM360 macros `%ecid!` (creative ID) and `%epid!` (placement ID) for automatic granularity.\n\nWhat source, medium, and campaign values would you like to use?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Luminance Beauty',
          description: 'Identifies the advertiser',
        },
        {
          type: 'contains',
          value: 'utm_',
          description: 'Discusses UTM parameters',
        },
        {
          type: 'contains',
          value: '%epid!',
          description: 'Recommends the placement ID macro',
        },
      ],
      description: 'Turn 1: Looks up Luminance Beauty and landing pages, asks for UTM values',
    },
    {
      userMessage: 'Use cm360 as the source, display as the medium, and inject the placement ID as the campaign parameter',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here is the URL pattern for Luminance Beauty landing pages with your specified UTM structure:\n\n**Landing Page URL Template:**\n```\nhttps://www.luminancebeauty.com?utm_source=cm360&utm_medium=display&utm_campaign=%epid!&utm_content=%ecid!\n```\n\n**Parameter breakdown:**\n| Parameter | Value | Type |\n|---|---|---|\n| utm_source | `cm360` | Static |\n| utm_medium | `display` | Static |\n| utm_campaign | `%epid!` | Dynamic — placement ID at serve time |\n| utm_content | `%ecid!` | Dynamic — creative ID at serve time |\n\n**At serve time, an example resolved URL might look like:**\n```\nhttps://www.luminancebeauty.com?utm_source=cm360&utm_medium=display&utm_campaign=90055&utm_content=90102\n```\n\n**Note:** Using `%epid!` as `utm_campaign` is unconventional — most setups put the campaign name or `%ebuy!` there and use `%epid!` in `utm_term`. But if your analytics team wants placement ID as the primary dimension in the campaign reports, this works fine. Just make sure everyone on the team knows the taxonomy.\n\nWould you like me to create or update the landing pages with this URL pattern?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'utm_source=cm360',
          description: 'Uses cm360 as the source',
        },
        {
          type: 'contains',
          value: 'utm_medium=display',
          description: 'Uses display as the medium',
        },
        {
          type: 'contains',
          value: '%epid!',
          description: 'Injects placement ID per user request',
        },
      ],
      description: 'Turn 2: Constructs the URL pattern with the user-specified UTM values',
    },
    {
      userMessage: 'Perfect. What about cache busting?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Cache busting is handled by the **%n** macro, which CM360 replaces with a random number at each serve time.\n\n**Good news:** For click-through URLs (which is what we are building), cache busting is less critical because each click is a unique user action. Cache busting is primarily important for **impression tags** — where the browser might cache the ad call and under-report impressions.\n\n**For impression tags:** CM360 automatically includes `ord=%n` in the generated ad serving tags. You do not need to add it manually — it is already there when you generate tags for placements.\n\n**For click-through URLs:** You generally do not need `%n` because:\n1. Each click is a unique user interaction (not a cached page load)\n2. The CM360 click tracker URL is already unique per click\n3. Adding `%n` to a landing page URL would create different URLs for analytics, fragmenting your data\n\n**When you WOULD add %n to a click-through URL:**\n- If you have a custom tracking redirect between CM360 and the landing page that caches responses\n- If a third-party tracker in the redirect chain needs a cache buster\n\nThe macro format is simply `%n` — for example:\n```\nhttps://tracking.example.com/redirect?cb=%n&url=https://www.luminancebeauty.com?utm_source=cm360...\n```\n\nFor your Luminance Beauty setup, I would not add `%n` to the landing page URL itself. The default CM360 tag generation handles cache busting for impressions automatically.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: '%n',
          description: 'Explains the %n cache buster macro',
        },
        {
          type: 'contains',
          value: 'random',
          description: 'Mentions random number generation',
        },
        {
          type: 'contains',
          value: 'impression',
          description: 'Explains impression tag context for cache busting',
        },
      ],
      description: 'Turn 3: Explains the %n cache buster macro and when it is needed',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-AT-003: Demandbase Campaign Setup (4 turns)
// User sets up a Demandbase ABM campaign for NovaTech
// ---------------------------------------------------------------------------

const demandbaseCampaignSetup: ConversationFlow = {
  id: 'FLOW-AT-003',
  name: 'Demandbase Campaign Setup',
  description:
    'User sets up a Demandbase ABM campaign for NovaTech targeting Fortune 500 tech companies — explains workflow, DV360 connection, macros, and tag format',
  turns: [
    {
      userMessage: "We're running a Demandbase ABM campaign for NovaTech targeting Fortune 500 tech companies",
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'That is a solid B2B strategy for NovaTech Solutions. Here is an overview of how a Demandbase ABM campaign works across the ad tech stack:\n\n**The workflow has three layers:**\n\n1. **Demandbase (targeting layer)**\n   - Define the target account list: Fortune 500 tech companies\n   - Demandbase identifies these companies using IP-to-company mapping and intent data\n   - Creates audience segments that can be activated in ad platforms\n\n2. **DV360 (buying layer)**\n   - Demandbase syncs its audience segments to DV360 as targeting lists\n   - DV360 handles the programmatic media buying — bidding on ad inventory only when the user matches the Demandbase target list\n   - You set budgets, bids, and frequency caps in DV360\n\n3. **CM360 (serving and tracking layer)**\n   - This is where I help. CM360 handles the actual ad delivery and tracking\n   - Create campaigns, placements, and click-through URLs in CM360\n   - CM360 serves the creatives and records impressions, clicks, and conversions\n\n**Key insight:** Demandbase does not interact directly with CM360. The targeting happens in DV360, and CM360 serves the ads. CM360 does not know the ads are Demandbase-targeted — it just sees normal traffic.\n\nWant me to look up NovaTech\'s existing campaigns so we can set up the CM360 side?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Demandbase',
          description: 'Explains the Demandbase workflow',
        },
        {
          type: 'contains',
          value: 'DV360',
          description: 'Explains the DV360 buying layer',
        },
        {
          type: 'contains',
          value: 'CM360',
          description: 'Explains CM360 serving role',
        },
      ],
      description: 'Turn 1: Explains the three-layer Demandbase/DV360/CM360 workflow',
    },
    {
      userMessage: 'How do we connect the Demandbase targeting to our CM360 placements?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'The connection between Demandbase targeting and CM360 placements flows through DV360. Here is the relationship:\n\n**DV360 → CM360 Connection:**\n\n1. **DV360 is the buyer, CM360 is the server**\n   - DV360 wins the bid for an impression (using Demandbase audience targeting)\n   - DV360 tells CM360 to serve the ad for that impression\n   - CM360 delivers the creative and tracks the impression/click\n\n2. **How placements connect:**\n   - When you create a DV360 campaign, you associate it with a CM360 campaign\n   - DV360 line items map to CM360 placements\n   - The Demandbase audience targeting is applied at the DV360 line item level\n   - CM360 placements just need to exist and have creatives assigned — they do not need any special configuration for Demandbase\n\n3. **What I do in CM360:**\n   - Create a campaign (e.g., "NovaTech Q2 2026 ABM Display")\n   - Create placements for the sites where DV360 will buy inventory\n   - Set up click-through URLs with tracking macros\n   - Generate tags that DV360 uses for ad serving\n\n**The targeting is invisible to CM360.** Whether an impression is Demandbase-targeted or broadly targeted, CM360 treats it the same way. The intelligence is in DV360\'s bidding decisions, not in CM360\'s serving.\n\nShall I help set up the CM360 campaign and placements for NovaTech?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'DV360',
          description: 'Explains DV360 as the connection point',
        },
        {
          type: 'contains',
          value: 'placement',
          description: 'Explains how placements relate',
        },
        {
          type: 'contains',
          value: 'targeting',
          description: 'Discusses how targeting is applied',
        },
      ],
      description: 'Turn 2: Explains how DV360 connects Demandbase targeting to CM360 placements',
    },
    {
      userMessage: 'What macros should I put in the click-through URL?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'For a Demandbase ABM campaign, I recommend the following macros in the click-through URL:\n\n**Recommended Click-Through URL:**\n```\nhttps://www.novatechsolutions.com/landing?\n  utm_source=cm360\n  &utm_medium=display\n  &utm_campaign=%ebuy!\n  &utm_content=%ecid!\n  &utm_term=%epid!\n  &channel=demandbase-abm\n```\n\n**Macro breakdown:**\n| Macro | What It Does | Why You Need It |\n|---|---|---|\n| %ebuy! | Campaign ID | Links clicks to the NovaTech ABM campaign |\n| %ecid! | Creative ID | Identifies which creative version the user saw |\n| %epid! | Placement ID | Shows which site/size drove the click |\n\n**Static parameters:**\n- `utm_source=cm360` — identifies the ad server\n- `utm_medium=display` — identifies the channel\n- `channel=demandbase-abm` — tags this traffic as coming from the Demandbase ABM campaign\n\n**Why the static `channel` parameter matters:**\nSince CM360 does not know about the Demandbase targeting, adding `channel=demandbase-abm` gives your analytics team a way to segment this traffic. They can then cross-reference it with Demandbase\'s own analytics to see which target accounts actually clicked.\n\nIf NovaTech also uses Adobe Analytics, add `ef_id=%eaid!:d` for Adobe attribution.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: '%ebuy!',
          description: 'Recommends campaign ID macro',
        },
        {
          type: 'contains',
          value: '%epid!',
          description: 'Recommends placement ID macro',
        },
        {
          type: 'contains',
          value: 'demandbase',
          description: 'Includes Demandbase channel identifier',
        },
      ],
      description: 'Turn 3: Recommends macros for the click-through URL with a Demandbase channel tag',
    },
    {
      userMessage: 'Should I use VAST or JavaScript tags for this?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'It depends on the creative format:\n\n**JavaScript tags — for display ads (banners, HTML5, rich media)**\n- This is the standard tag type for most display campaigns\n- Works with 300x250, 728x90, 160x600, and all standard IAB sizes\n- The tag is a `<script>` snippet the publisher (or DV360) implements\n- If NovaTech\'s ABM campaign uses banner creatives, use JavaScript tags\n\n**VAST tags — for video ads (pre-roll, mid-roll, outstream)**\n- VAST (Video Ad Serving Template) is the IAB standard for video ad delivery\n- Used when the creative is a video file played in a video player\n- The tag is a URL that points to a VAST XML document, not a script snippet\n- If NovaTech\'s ABM campaign includes video placements (e.g., on Hulu), use VAST tags\n\n**For a typical Demandbase ABM campaign targeting Fortune 500 tech companies:**\n- Most B2B display campaigns use **JavaScript tags** with standard banner sizes\n- 300x250 and 728x90 are the most common B2B display sizes\n- Video is less common for B2B ABM but can work for awareness goals\n\n**My recommendation:** Start with JavaScript tags for display placements. If NovaTech also wants video inventory (Hulu, Spotify video), create separate IN_STREAM_VIDEO placements with VAST tags.\n\nWant me to set up display placements for NovaTech\'s ABM campaign? I will use JavaScript tag format.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'JavaScript',
          description: 'Recommends JavaScript tags for display',
        },
        {
          type: 'contains',
          value: 'VAST',
          description: 'Explains VAST for video',
        },
        {
          type: 'contains',
          value: 'display',
          description: 'Recommends display for B2B ABM',
        },
      ],
      description: 'Turn 4: Recommends JavaScript tags for display and VAST for video based on creative format',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-AT-004: Verification + Attribution Stack (4 turns)
// User sets up DoubleVerify + Adobe Analytics for Meridian Financial
// ---------------------------------------------------------------------------

const verificationAttributionStack: ConversationFlow = {
  id: 'FLOW-AT-004',
  name: 'Verification + Attribution Stack',
  description:
    'User sets up DoubleVerify brand safety + Adobe Analytics attribution for Meridian Financial — confirms both can run simultaneously, builds complete tag and URL setup',
  turns: [
    {
      userMessage: 'We need DoubleVerify on all Meridian Financial placements for brand safety',
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
              text: 'I found **Meridian Financial** (ID: 90002) and their campaigns. DoubleVerify for brand safety is a smart choice for a financial services advertiser.\n\n**How to add DoubleVerify to all Meridian Financial placements:**\n\n1. **Get the DV verification tag** from your DoubleVerify account manager. It will be a JavaScript snippet.\n\n2. **Create an event tag in CM360** at the advertiser level (Meridian Financial):\n   - Type: Impression verification\n   - Tag code: paste the DV JavaScript\n   - Fire on: Impressions\n\n3. **Apply to all campaigns** — by creating the event tag at the advertiser level, it can be assigned to all Meridian Financial campaigns and their placements automatically.\n\n**For financial services specifically,** I recommend configuring DV to flag:\n- Financial fraud and scam content\n- Controversial political content\n- Misinformation and fake news\n- Adult content\n\nThese are the highest-risk categories for a financial brand like Meridian.\n\nDo you have the DV tag ready, or do you need to request it from your DV rep?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Meridian Financial',
          description: 'Identifies the advertiser',
        },
        {
          type: 'contains',
          value: 'DoubleVerify',
          description: 'Explains DV brand safety setup',
        },
        {
          type: 'contains',
          value: 'event tag',
          description: 'Recommends event tags',
        },
      ],
      description: 'Turn 1: Looks up Meridian Financial, explains DoubleVerify brand safety event tag setup',
    },
    {
      userMessage: 'Also need Adobe Analytics attribution — can both run simultaneously?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Yes — and yes, they can absolutely run simultaneously without any conflict. They serve completely different purposes and operate independently.\n\n**How they coexist:**\n\n| Layer | Tool | Mechanism | Purpose |\n|---|---|---|---|\n| Verification | DoubleVerify | Event tag (fires on impression) | Brand safety, viewability, fraud detection |\n| Attribution | Adobe Analytics | Click-through URL parameters | Conversion tracking, cross-channel attribution |\n\n**Why there is no conflict:**\n- DoubleVerify runs as an **event tag** — it fires alongside the CM360 impression tag, measuring ad quality\n- Adobe Analytics runs through **click-through URL parameters** — it captures data when the user clicks and lands on your page\n- They do not interact with each other at all\n\n**Your Meridian Financial stack will look like this:**\n```\nCM360 Ad Serving Tag (serves the creative)\n  ├── Event Tag: DoubleVerify (brand safety, fires on impression)\n  └── Click-Through URL: includes ef_id and s_kwcid (Adobe attribution, fires on click)\n```\n\nYou can even add more event tags — for example, IAS for viewability, Nielsen for audience measurement — all running in parallel on the same placements.\n\nWant me to walk you through the complete tag and URL setup?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'yes',
          description: 'Confirms both can run simultaneously',
        },
        {
          type: 'contains',
          value: 'DoubleVerify',
          description: 'References DV in the combined setup',
        },
        {
          type: 'contains',
          value: 'Adobe',
          description: 'References Adobe in the combined setup',
        },
      ],
      description: 'Turn 2: Confirms DV and Adobe can run simultaneously, explains how they coexist',
    },
    {
      userMessage: 'Walk me through the complete tag and URL setup',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here is the complete setup for Meridian Financial with DoubleVerify brand safety and Adobe Analytics attribution:\n\n**Part 1: Click-Through URL (Adobe Attribution)**\n```\nhttps://www.meridianfinancial.com?ef_id=%eaid!:d&s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!&utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!&utm_term=%epid!\n```\n\n**Part 2: Event Tags (Verification)**\n- **DoubleVerify brand safety event tag:**\n  - Type: Impression verification\n  - Fires on: Impressions\n  - Applied to: All Meridian Financial campaigns\n  - Code: `<script src="https://cdn.doubleverify.com/dvtp_src.js?ctx={dv_context_id}"></script>`\n\n**Part 3: CM360 Ad Serving Tag (auto-generated)**\n- Generated by CM360 for each placement\n- Includes impression tracking, click redirect, and cache buster\n- The DV event tag fires automatically alongside this\n\n**How it all works together at serve time:**\n1. Publisher page loads → CM360 ad serving tag fires\n2. Creative renders → DV event tag fires (brand safety check)\n3. User clicks → CM360 click tracker fires → resolves macros → redirects to landing page\n4. Landing page loads → Adobe captures ef_id and s_kwcid → Google Analytics captures UTMs\n5. User converts → Floodlight tag fires back to CM360 → Adobe records conversion\n\nEverything is independent and runs without interference. Replace `{adobe_id}` with the real Adobe account ID and `{dv_context_id}` with the DV context provided by your DV rep.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'ef_id',
          description: 'Includes Adobe ef_id in the URL',
        },
        {
          type: 'contains',
          value: 'DoubleVerify',
          description: 'Includes DV in the complete setup',
        },
        {
          type: 'contains',
          value: '%epid!',
          description: 'Uses CM360 macros in the URL',
        },
      ],
      description: 'Turn 3: Provides the complete tag and URL setup with both DV and Adobe',
    },
    {
      userMessage: 'What about the impression vs click discrepancy issue?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Impression and click discrepancies between CM360, DoubleVerify, and Adobe are normal and expected. Here are the common causes and what to watch for:\n\n**CM360 vs DoubleVerify impression discrepancy (typical: 2-5%):**\n- **Latency:** DV event tags fire slightly after the CM360 impression tag. If the user navigates away quickly, CM360 records the impression but DV might not\n- **Ad blocking:** Some ad blockers let CM360 tags through but block DV JavaScript\n- **Tag loading order:** If the page is slow, the DV event tag may not fire before the user scrolls past\n- **Acceptable range:** 2-5% difference is normal. Over 10% indicates a technical issue\n\n**CM360 vs Adobe click discrepancy (typical: 5-15%):**\n- **Redirect drop-off:** CM360 records the click when the user clicks the ad. Adobe records it when the landing page JavaScript fires. If the user closes the tab during redirect, CM360 has a click but Adobe does not\n- **JavaScript blocking:** If Adobe\'s JavaScript fails to load on the landing page, the click is lost in Adobe but still counted in CM360\n- **Parameter stripping:** Some redirects or landing page setups strip URL parameters, causing Adobe to lose the ef_id\n- **Bot filtering:** CM360 and Adobe may filter bot traffic differently\n\n**How to diagnose:**\n1. Compare click counts for a single placement on a single day\n2. Check that the click-through URL resolves correctly (test with a real click)\n3. Verify the landing page does not redirect and strip parameters\n4. Confirm Adobe JavaScript is firing on the landing page\n5. Check the DV dashboard for tag health metrics\n\n**Action items:** A 5-15% click discrepancy is normal. If it exceeds 20%, investigate the redirect chain and parameter preservation first.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'discrepancy',
          description: 'Addresses the discrepancy issue directly',
        },
        {
          type: 'contains',
          value: 'impression',
          description: 'Discusses impression discrepancies',
        },
        {
          type: 'contains',
          value: 'click',
          description: 'Discusses click discrepancies',
        },
      ],
      description: 'Turn 4: Explains common causes of impression and click discrepancies between platforms',
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-AT-005: Complex Multi-Tool Workflow (4 turns)
// User sets up Crestview Hotels with Adobe + DoubleVerify + Demandbase
// ---------------------------------------------------------------------------

const complexMultiToolWorkflow: ConversationFlow = {
  id: 'FLOW-AT-005',
  name: 'Complex Multi-Tool Workflow',
  description:
    'User sets up Crestview Hotels with Adobe Analytics, DoubleVerify verification, and Demandbase B2B targeting — breaks down the workflow, builds URLs, configures event tags, and recommends QA approach',
  turns: [
    {
      userMessage: "I'm setting up a new campaign for Crestview Hotels — they use Adobe for analytics, DoubleVerify for verification, and Demandbase for B2B targeting",
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
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'I found **Crestview Hotels** (ID: 90005). That is a sophisticated ad tech stack — let me break down the workflow for each tool and how they all fit together:\n\n**1. Demandbase (B2B Targeting)**\n- Defines the target account list (e.g., corporate travel managers, event planners at Fortune 1000 companies)\n- Syncs audience segments to DV360 for programmatic buying\n- Not configured in CM360 — happens upstream\n\n**2. CM360 (Ad Serving — what I help with)**\n- Create the campaign and placements\n- Configure click-through URLs with Adobe tracking parameters and CM360 macros\n- Generate ad serving tags\n\n**3. DoubleVerify (Verification)**\n- Brand safety monitoring via event tags in CM360\n- Fires alongside the ad serving tag on every impression\n- Reports on content adjacency, viewability, and fraud\n\n**4. Adobe Analytics (Attribution)**\n- Captures click data via ef_id and s_kwcid parameters in the landing page URL\n- Provides cross-channel attribution and conversion tracking\n\n**Setup order:**\n1. First: CM360 campaign, placements, and click-through URLs (I can do this now)\n2. Second: DoubleVerify event tags (need the DV tag from your rep)\n3. Third: Demandbase audience sync to DV360 (done by the media buying team)\n4. Fourth: Verify Adobe is capturing parameters on the landing page\n\nShall we start with the click-through URL?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'Crestview Hotels',
          description: 'Identifies the advertiser',
        },
        {
          type: 'contains',
          value: 'Demandbase',
          description: 'Covers Demandbase in the workflow',
        },
        {
          type: 'contains',
          value: 'DoubleVerify',
          description: 'Covers DoubleVerify in the workflow',
        },
        {
          type: 'contains',
          value: 'Adobe',
          description: 'Covers Adobe in the workflow',
        },
      ],
      description: 'Turn 1: Looks up Crestview Hotels and breaks down the multi-tool workflow',
    },
    {
      userMessage: 'Start with the click-through URL — what parameters do I need?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here is the comprehensive click-through URL for Crestview Hotels, covering Adobe Analytics, Google Analytics, and Demandbase campaign tagging:\n\n**Click-Through URL:**\n```\nhttps://www.crestviewhotels.com?ef_id=%eaid!:d&s_kwcid=AL!{adobe_id}!d!%ebuy!_%epid!&utm_source=cm360&utm_medium=display&utm_campaign=%ebuy!&utm_content=%ecid!&utm_term=%epid!&channel=demandbase-abm\n```\n\n**Parameter breakdown:**\n\n| Parameter | Value | Platform | Purpose |\n|---|---|---|---|\n| ef_id | `%eaid!:d` | Adobe | Primary attribution (ad ID + display flag) |\n| s_kwcid | `AL!{id}!d!%ebuy!_%epid!` | Adobe | Advertising Cloud connector |\n| utm_source | `cm360` | GA | Traffic source |\n| utm_medium | `display` | GA | Channel |\n| utm_campaign | `%ebuy!` | GA | Campaign ID (dynamic) |\n| utm_content | `%ecid!` | GA | Creative ID (dynamic) |\n| utm_term | `%epid!` | GA | Placement ID (dynamic) |\n| channel | `demandbase-abm` | All | Identifies Demandbase-targeted traffic |\n\n**At serve time, a resolved example:**\n```\nhttps://www.crestviewhotels.com?ef_id=90130:d&s_kwcid=AL!9999!d!90030_90060&utm_source=cm360&utm_medium=display&utm_campaign=90030&utm_content=90110&utm_term=90060&channel=demandbase-abm\n```\n\nReplace `{adobe_id}` with Crestview Hotels\' actual Adobe account ID. Ready for the event tag setup?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'ef_id',
          description: 'Includes Adobe ef_id',
        },
        {
          type: 'contains',
          value: '%epid!',
          description: 'Includes placement ID macro',
        },
        {
          type: 'contains',
          value: 'crestviewhotels',
          description: 'Uses the Crestview Hotels domain',
        },
        {
          type: 'contains',
          value: 'demandbase-abm',
          description: 'Includes Demandbase channel tag',
        },
      ],
      description: 'Turn 2: Constructs the comprehensive click-through URL with all platform parameters',
    },
    {
      userMessage: 'Now the event tags — what do I need for DV and any others?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here is the event tag setup for Crestview Hotels:\n\n**Event Tag 1: DoubleVerify Brand Safety (Required)**\n- **Type:** Impression verification\n- **Fires on:** Impressions\n- **Tag code:** `<script src="https://cdn.doubleverify.com/dvtp_src.js?ctx={dv_context_id}"></script>`\n- **Apply to:** All Crestview Hotels campaigns\n- **Purpose:** Brand safety monitoring, content adjacency verification\n\n**Event Tag 2: DoubleVerify Viewability (Recommended)**\n- **Type:** Impression verification\n- **Fires on:** Impressions\n- **Tag code:** Usually the same DV tag — DV measures both brand safety and viewability in one call\n- **Purpose:** MRC-standard viewability measurement\n\n**Event Tag 3: Nielsen DAR (Optional — if Crestview wants audience measurement)**\n- **Type:** Third-party\n- **Fires on:** Impressions\n- **Purpose:** Demographic audience verification — confirms the ads are reaching the intended audience\n\n**How to create event tags in CM360:**\n1. Go to the Crestview Hotels advertiser level in CM360\n2. Create each event tag with the tag code from the vendor\n3. Set the trigger (impressions, clicks, or both)\n4. Assign the event tags to campaigns — they will automatically apply to all placements in those campaigns\n\n**Performance note:** Each event tag adds 10-50ms of latency. DV is typically under 20ms. Running 2-3 event tags simultaneously is standard and should not noticeably impact ad load time.\n\nGet the DV tag from your DoubleVerify account representative and I can help you plan the rest of the campaign setup.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'DoubleVerify',
          description: 'Covers DoubleVerify event tags',
        },
        {
          type: 'contains',
          value: 'event tag',
          description: 'Explains event tag setup',
        },
        {
          type: 'contains',
          value: 'brand safety',
          description: 'Covers brand safety use case',
        },
        {
          type: 'contains',
          value: 'viewability',
          description: 'Covers viewability measurement',
        },
      ],
      description: 'Turn 3: Explains event tag setup for DV brand safety, viewability, and optional Nielsen',
    },
    {
      userMessage: 'How do I verify everything is working after trafficking?',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Here is a QA checklist to verify the full Crestview Hotels setup after trafficking:\n\n**Step 1: Test the click-through URL (5 minutes)**\n- Click a test ad (or use the CM360 tag preview)\n- Verify you land on `https://www.crestviewhotels.com` with all parameters intact\n- Check that `ef_id`, `s_kwcid`, all UTM parameters, and `channel=demandbase-abm` are in the URL\n- If any parameters are missing, check for redirect strips or URL encoding issues\n\n**Step 2: Verify Adobe is capturing data (15 minutes)**\n- Open Adobe Analytics real-time reports\n- Click a test ad\n- Confirm the visit appears with the correct `ef_id` and `s_kwcid` values\n- Check that the eVar mapped to `ef_id` is populated\n\n**Step 3: Verify DoubleVerify event tags (30 minutes)**\n- Log into the DoubleVerify dashboard\n- Check the Crestview Hotels campaign for incoming impressions\n- Verify brand safety scores are being reported\n- Compare DV impression count with CM360 — should be within 2-5%\n\n**Step 4: Verify CM360 native tracking (immediate)**\n- Check the CM360 campaign dashboard\n- Confirm impressions and clicks are being recorded\n- Verify click-through rates look reasonable (0.05-0.15% for display is normal)\n\n**Step 5: Verify Demandbase targeting (1-2 days)**\n- Check the Demandbase analytics dashboard\n- Confirm the target account list is being served\n- Cross-reference Demandbase company data with CM360 placement data\n- This takes longer because you need actual traffic volume to validate\n\n**Common issues to watch for:**\n- Click-through URL exceeds 2,048 characters (truncation)\n- Landing page redirects strip parameters\n- Adobe JavaScript not loading on certain landing page variants\n- DV event tag blocked by aggressive ad blockers\n- Cache issues — clear browser cache before testing\n\nI recommend running through Steps 1-4 before going live. Step 5 can be validated after launch.',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        {
          type: 'contains',
          value: 'QA',
          description: 'Provides a QA verification approach',
        },
        {
          type: 'contains',
          value: 'Adobe',
          description: 'Includes Adobe verification step',
        },
        {
          type: 'contains',
          value: 'DoubleVerify',
          description: 'Includes DV verification step',
        },
        {
          type: 'contains',
          value: 'click-through',
          description: 'Includes click-through URL testing',
        },
      ],
      description: 'Turn 4: Provides a comprehensive QA checklist for verifying the full multi-tool setup',
    },
  ],
};

// ---------------------------------------------------------------------------
// Export all advanced trafficking conversation flows
// ---------------------------------------------------------------------------

export const ADVANCED_TRAFFICKING_FLOWS: ConversationFlow[] = [
  adobeIntegrationSetup,
  utmMacroInjection,
  demandbaseCampaignSetup,
  verificationAttributionStack,
  complexMultiToolWorkflow,
];
