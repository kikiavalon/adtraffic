/**
 * Video trafficking multi-turn conversation flows (5 flows, 18 turns total).
 *
 * These test that Kiki can guide users through video-specific trafficking
 * workflows including tag type selection, vendor spec review, VPAID
 * migration, complete video trafficking, and mixed display + video setups.
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

import type { ConversationFlow } from './conversation-flows.js';

// ---------------------------------------------------------------------------
// FLOW-VT-001: Tag Type Selection for Video Campaign
// User needs video tags, doesn't know the tag type, gets a recommendation,
// provides spec, and confirms tag generation.
// ---------------------------------------------------------------------------

const tagTypeSelection: ConversationFlow = {
  id: 'FLOW-VT-001',
  name: 'Tag Type Selection for Video Campaign',
  description:
    'User starts a video trafficking task for Apex Motors on Hulu, asks for tag type recommendation, provides publisher spec, and confirms generation',
  turns: [
    {
      userMessage: 'I need to set up video tags for the Apex Motors campaign on Hulu',
      description: 'Turn 1: Kiki looks up advertiser and site, asks about tag type',
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
            { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'Hulu' } },
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
            {
              type: 'text',
              text: 'I found Apex Motors and Hulu in the account. Apex Motors has these campaigns:\n\n| Campaign | Dates |\n|---|---|\n| Apex Q1 2026 Display Awareness | Jan-Mar 2026 |\n| Apex Q2 2026 Video Conversions | Apr-Jun 2026 |\n| Apex Q3 2026 Mobile Retargeting | Jul-Sep 2026 |\n\nThe **Apex Q2 2026 Video Conversions** campaign looks like the right fit for video tags on Hulu.\n\nBefore we proceed, I need to know the **tag type**. For video on Hulu, VAST is the standard. Do you have Hulu\'s trafficking spec? Specifically, I need to know:\n1. Which VAST version? (4.1, 4.0, 3.0)\n2. Video duration? (15s, 30s)\n3. Video dimensions? (640x360, 1920x1080)\n\nOr would you like me to recommend a default configuration?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Apex', description: 'References the advertiser' },
        { type: 'contains', value: 'Hulu', description: 'References the site' },
        { type: 'contains', value: 'VAST', description: 'Asks about VAST tag type' },
      ],
    },
    {
      userMessage: "I don't know — what do you recommend?",
      description: 'Turn 2: Kiki recommends VAST 4.1 and explains the reasoning',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'For a video campaign on Hulu, here\'s my recommendation:\n\n**Recommended Configuration:**\n- **Tag type:** VAST 4.1\n- **Reasoning:** VAST 4.1 is the latest version and gives you the best tracking, verification, and SSAI support. Hulu is a premium streaming platform that supports modern VAST versions.\n\n**Why VAST 4.1 over other options:**\n- **vs. VAST 3.0:** 4.1 adds viewability verification resources and better server-side ad insertion (SSAI) support — both important for premium streaming platforms like Hulu\n- **vs. VPAID:** Hulu doesn\'t accept VPAID tags (most streaming platforms don\'t)\n- **vs. JavaScript:** JavaScript tags are for display banners, not video players\n\n**Standard pre-roll specs for Hulu-type platforms:**\n- Duration: 15s or 30s (15s is more common for streaming)\n- Size: 1920x1080 (HD) or 640x360 (SD)\n- File format: MP4 (H.264)\n\nThat said, I always recommend confirming with the publisher spec before generating final tags. Do you want to proceed with VAST 4.1, or would you rather wait until you have the Hulu spec?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VAST 4.1', description: 'Recommends VAST 4.1 specifically' },
        { type: 'contains', value: 'Hulu', description: 'Contextualizes for Hulu' },
        { type: 'contains', value: 'streaming', description: 'Explains relevance to streaming platform' },
      ],
    },
    {
      userMessage: "Let's go with VAST 4.1. The publisher spec says max 30 seconds, 640x360",
      description: 'Turn 3: Kiki confirms the spec requirements and shows a placement preview',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: 'Got it! Here\'s the placement I\'d set up:\n\n**Video Placement Preview:**\n- **Campaign:** Apex Q2 2026 Video Conversions\n- **Site:** Hulu.com\n- **Tag type:** VAST 4.1\n- **Size:** 640x360\n- **Duration:** 30s max\n- **Name:** Hulu_Apex_640x360_0426_Video\n- **Dates:** 2026-04-01 to 2026-06-30 (matching the campaign)\n\n**Spec compliance check:**\n- VAST 4.1 — confirmed\n- 30 seconds max duration — confirmed\n- 640x360 dimensions — confirmed\n\nEverything aligns with the publisher spec. Shall I create this placement and generate the VAST 4.1 tags?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VAST 4.1', description: 'Confirms VAST 4.1' },
        { type: 'contains', value: '640x360', description: 'Confirms the dimensions from spec' },
        { type: 'contains', value: '30', description: 'Confirms the duration from spec' },
      ],
    },
    {
      userMessage: 'Yes, generate the tags',
      description: 'Turn 4: Kiki confirms tag generation in VAST 4.1 format',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: 'The video placement has been set up and here are the generated tags:\n\n**Placement:** Hulu_Apex_640x360_0426_Video\n\n**VAST 4.1 Tag URL:**\n```\nhttps://ad.doubleclick.net/ddm/pfadx/N67890.Hulu/B90000;dc_trk_aid=90024;dc_trk_cid=90026;sz=640x360;ord=[timestamp];dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;npa=;gdpr=${GDPR};gdpr_consent=${GDPR_CONSENT_755};ltd=\n```\n\n**What to send to Hulu:**\n- The VAST tag URL above\n- Confirm: VAST 4.1 format, 640x360, max 30 seconds\n- Make sure your video creative is uploaded and assigned before the campaign start date (April 1)\n\n**Next steps:**\n1. Upload the video creative (MP4, 640x360, under 30s)\n2. Create an ad linking the creative to this placement\n3. Send the VAST tag URL to Hulu\'s ad ops team\n4. QA: verify the tag returns valid VAST XML\n\nAnything else you need for this campaign?',
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VAST', description: 'Confirms VAST tag was generated' },
        { type: 'contains', value: 'Hulu', description: 'Tags are for Hulu' },
        { type: 'contains', value: 'doubleclick', description: 'Shows actual tag URL' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-VT-002: Vendor Spec Review
// User shares a publisher spec, discovers a creative size mismatch,
// and asks about version compatibility.
// ---------------------------------------------------------------------------

const vendorSpecReview: ConversationFlow = {
  id: 'FLOW-VT-002',
  name: 'Vendor Spec Review',
  description:
    'User shares ESPN video spec, discovers creative size mismatch, asks about VAST version compatibility',
  turns: [
    {
      userMessage: "ESPN sent their video trafficking spec — they want VAST 3.0, 15s and 30s pre-roll, 640x480, max 10MB",
      description: 'Turn 1: Kiki summarizes the spec clearly',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "Thanks for sharing ESPN's spec. Here's my summary of their video trafficking requirements:\n\n**ESPN Video Spec Summary:**\n| Requirement | Value |\n|---|---|\n| Tag Type | VAST 3.0 |\n| Durations | 15s and 30s pre-roll |\n| Dimensions | 640x480 (SD, 4:3 aspect ratio) |\n| Max File Size | 10MB |\n\n**A few things to note:**\n\n1. **VAST 3.0** — This is a solid, widely-supported version. You'll have ad pod support and skippable ad controls, but you'll miss VAST 4.0+ features like viewability verification resources.\n\n2. **640x480 (4:3 aspect ratio)** — This is a non-standard aspect ratio in today's market. Most video content is 16:9 (640x360 or 1920x1080). Make sure your creative team delivers the video at 640x480 specifically, or you'll have letterboxing/pillarboxing issues.\n\n3. **10MB max** — This is relatively tight for video. A 30s video at 640x480 should fit, but you'll need good compression. 15s videos will be no problem.\n\nWhich advertiser and campaign is this ESPN buy for? I can start setting up the placements to match these specs.",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VAST 3.0', description: 'Captures tag type from spec' },
        { type: 'contains', value: '640x480', description: 'Captures dimensions from spec' },
        { type: 'contains', value: '15s', description: 'Captures 15s duration' },
        { type: 'contains', value: '10MB', description: 'Captures file size limit' },
      ],
    },
    {
      userMessage: "We have 1920x1080 creatives — will that work with their 640x480 requirement?",
      description: 'Turn 2: Kiki explains the size mismatch issue',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "That's a significant mismatch — and it goes beyond just resolution:\n\n**The problem:**\n- Your creative: **1920x1080** (16:9 aspect ratio, widescreen)\n- ESPN's spec: **640x480** (4:3 aspect ratio, standard)\n\nThese are different **aspect ratios**, not just different resolutions. If you send a 16:9 video to a 4:3 player slot, one of two things will happen:\n\n1. **Letterboxing** — black bars appear on top and bottom of your video (the player preserves your 16:9 ratio within the 4:3 frame). Your creative appears smaller than intended.\n\n2. **Cropping** — the player crops the sides of your video to fill the 4:3 frame. You lose the left and right edges of the creative.\n\nNeither is ideal for a premium placement like ESPN.\n\n**What you need to do:**\nAsk your creative team to produce a **640x480 (4:3) version** of the video. This usually means:\n- Re-rendering the video at 640x480\n- Or re-editing with a 4:3 safe zone in mind (important elements centered)\n- Ensure the file size stays under 10MB after re-encoding\n\n**If re-rendering isn't possible:**\nYou could transcode the 1920x1080 to 640x480 with letterboxing, but check with the ESPN ad ops team whether they accept letterboxed creatives. Many premium publishers reject them.\n\nWant me to proceed with setting up the placement at 640x480 while the creative team prepares the new render?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: '1920x1080', description: 'References the current creative size' },
        { type: 'contains', value: '640x480', description: 'References the ESPN requirement' },
        { type: 'contains', value: 'aspect ratio', description: 'Explains the aspect ratio mismatch' },
      ],
    },
    {
      userMessage: "OK so we need to resize. What about the VAST version — can we use 4.1 instead of 3.0?",
      description: 'Turn 3: Kiki explains VAST version compatibility',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "I'd recommend sticking with VAST 3.0 as ESPN specified. Here's why:\n\n**The risk of sending VAST 4.1 to a 3.0 player:**\n- ESPN's video player is built and tested for VAST 3.0\n- VAST 4.1 includes XML elements and attributes that don't exist in the 3.0 spec (verification nodes, mezzanine file references, interactive creative files)\n- A 3.0 parser encountering unknown 4.1 elements may:\n  - **Best case:** Ignore the unknown elements and play the ad (graceful degradation)\n  - **Worst case:** Fail to parse the VAST XML entirely and show no ad\n\n**Is it technically possible?** Sometimes. VAST is somewhat backward-compatible in structure, and many players will skip unknown elements. But \"sometimes works\" isn't good enough for a paid media buy — if ESPN's player chokes on the 4.1 elements, you get zero delivery and a very unhappy publisher.\n\n**What you lose with 3.0 vs. 4.1:**\n- Viewability verification resources (you can still use third-party pixels for viewability)\n- SSAI-specific tracking (not relevant for client-side delivery)\n- Interactive creative file references (not relevant for standard pre-roll)\n\n**Bottom line:** Use VAST 3.0 as the spec says. The features you lose are nice-to-haves, not must-haves for a standard pre-roll campaign. The publisher spec is always the final word.\n\nSo to summarize the ESPN plan:\n- Resize creative to 640x480 (4:3)\n- Keep under 10MB\n- Generate VAST 3.0 tags\n- Both 15s and 30s durations\n\nReady to set up the placements?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VAST 3.0', description: 'Recommends sticking with 3.0' },
        { type: 'contains', value: '4.1', description: 'Addresses the 4.1 question' },
        { type: 'contains', value: 'publisher', description: 'Defers to publisher spec as authoritative' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-VT-003: VPAID to VAST Migration
// User discovers their VPAID tags are being dropped, learns about the
// industry shift, and explores alternatives for interactivity.
// ---------------------------------------------------------------------------

const vpaidMigration: ConversationFlow = {
  id: 'FLOW-VT-003',
  name: 'VPAID to VAST Migration',
  description:
    'User learns their VPAID tags are being dropped by a publisher, explores migration to VAST, and asks about interactive alternatives',
  turns: [
    {
      userMessage: "Our Luminance Beauty campaign is using VPAID tags but the publisher just told us they're dropping VPAID support",
      description: 'Turn 1: Kiki explains the industry shift away from VPAID',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "Unfortunately, this is becoming very common. The industry is moving away from VPAID, and more publishers are dropping support every quarter.\n\n**Why publishers are dropping VPAID:**\n- **Security vulnerabilities** — VPAID ads execute arbitrary JavaScript inside the video player, which has been exploited for malware, data harvesting, and ad fraud. These security and performance issues have made VPAID untenable for many publishers\n- **Performance degradation** — VPAID ads often cause buffering, latency, and player crashes, leading to poor user experience\n- **Measurement unreliability** — Because VPAID ads control their own environment, viewability and verification tools can't always measure them accurately\n- **Industry guidance** — The IAB Tech Lab itself has recommended phasing out VPAID in favor of SIMID\n\n**What this means for the Luminance Beauty campaign:**\n- Any existing VPAID placements on this publisher will stop serving once they flip the switch\n- You'll need to transition to VAST tags to maintain delivery\n- If the campaign is currently running, this is time-sensitive — you need new tags before the VPAID cutoff date\n\n**Immediate action items:**\n1. Find out the publisher's VPAID cutoff date\n2. Determine if your video creative can work as a standard VAST ad (without the interactive VPAID features)\n3. Generate new VAST tags and send them to the publisher\n\nDo you know which publisher this is and which campaign/placements are affected? I can help you plan the transition.",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VPAID', description: 'Addresses the VPAID situation directly' },
        { type: 'contains', value: 'VAST', description: 'Introduces VAST as the replacement' },
        { type: 'contains', value: 'security', description: 'Explains security as a reason for the shift' },
      ],
    },
    {
      userMessage: 'Can we switch to VAST without changing the creative?',
      description: 'Turn 2: Kiki explains what needs to change in the creative',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "It depends on what your VPAID creative does. Here's the breakdown:\n\n**If the creative is a standard video ad** (plays a video, tracks events, handles clicks):\n- **Yes, you can switch to VAST with no creative changes.** The video file itself (MP4) works the same way in both VAST and VPAID. You just need new VAST tags pointing to the same video asset.\n\n**If the creative uses VPAID-specific interactive features:**\n- Expandable overlays\n- Custom UI controls (product carousels, quizzes)\n- Dynamic content injection\n- Player manipulation (resize, pause, custom progress bars)\n\n...then **those interactive elements will not work with standard VAST.** VAST is a declarative XML protocol — it tells the player what to show, but the ad creative can't control the player.\n\n**What needs to change:**\n| Feature | VPAID | VAST |\n|---|---|---|\n| Video playback | Same | Same |\n| Click-through | Same | Same |\n| Impression/quartile tracking | Same | Same |\n| Interactive overlays | Supported | Not supported |\n| Custom controls | Supported | Not supported |\n| Player manipulation | Supported | Not supported |\n\n**For Luminance Beauty specifically:**\nDo you know if the creative has interactive features, or is it a standard video ad? If it's standard video, we can do a tag-only swap with no creative changes. If it has interactive elements, we'll need to either simplify the creative or explore alternatives (which I can walk you through).",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'VAST', description: 'Explains VAST compatibility' },
        { type: 'contains', value: 'interactive', description: 'Addresses interactive features' },
        { type: 'contains', value: 'Luminance Beauty', description: 'References the specific advertiser' },
      ],
    },
    {
      userMessage: 'What if we need the interactive features that VPAID provided?',
      description: 'Turn 3: Kiki recommends SIMID and other alternatives',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "Good news — there are alternatives that provide interactivity without the security issues of VPAID. Here are your options:\n\n**1. SIMID (Secure Interactive Media Interface Definition) — Recommended**\n- The IAB's official replacement for VPAID\n- Provides interactive ad features (overlays, custom controls, product galleries) but in a **sandboxed iframe** rather than running directly in the video player\n- Much more secure — the ad can't access the player's DOM or execute arbitrary code\n- Growing publisher support, but not yet universal\n- **Check with the publisher** if they support SIMID before committing\n\n**2. VAST + Interactive Companion Banner**\n- Use standard VAST for the video portion\n- Add a rich media HTML5 companion banner (e.g., 300x250) alongside the video player\n- The companion can have full interactivity: expandable, clickable product carousels, form inputs, etc.\n- Works with any publisher that supports companion ads\n- **Most compatible option** today\n\n**3. VAST 4.1 with Interactive End Card**\n- Use standard VAST for the video\n- Include an interactive end card that appears when the video finishes\n- Limited interactivity, but no publisher compatibility issues\n\n**4. Custom rich media unit**\n- Some DSPs and creative platforms offer proprietary interactive video formats\n- Publisher-specific — works only where supported\n- Not portable across publishers\n\n**My recommendation for Luminance Beauty:**\nStart with option 2 (VAST + interactive companion). It gives you the best of both worlds: reliable video delivery via VAST, plus rich interactivity via the companion banner. Check with the publisher about SIMID for future campaigns.\n\nWould you like me to help set up a VAST + companion configuration?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'SIMID', description: 'Recommends SIMID as VPAID replacement' },
        { type: 'contains', value: 'companion', description: 'Suggests companion banner alternative' },
        { type: 'contains', value: 'VAST', description: 'Ties everything back to VAST' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-VT-004: Complete Video Trafficking Flow
// User traffics a full video campaign across two sites — Hulu and Spotify —
// creating placements one at a time.
// ---------------------------------------------------------------------------

const completeVideoTrafficking: ConversationFlow = {
  id: 'FLOW-VT-004',
  name: 'Complete Video Trafficking Flow',
  description:
    'User traffics a video campaign for Crestview Hotels on Hulu and Spotify, creating placements step by step',
  turns: [
    {
      userMessage: 'I need to traffic a video campaign for Crestview Hotels on Hulu and Spotify — pre-roll 15s',
      description: 'Turn 1: Kiki looks up data and asks about tag type',
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
            { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'tu_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90005' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: "I found Crestview Hotels and both sites. Here are the Crestview campaigns:\n\n| Campaign | Dates |\n|---|---|\n| Crestview Q1 2026 | Jan-Mar 2026 |\n| Crestview Q2 2026 | Apr-Jun 2026 |\n| Crestview Q3 2026 | Jul-Sep 2026 |\n\nBefore I set up the video placements on Hulu and Spotify, I need to confirm:\n\n1. **Which campaign** should these placements go in?\n2. **Tag type** — For both Hulu and Spotify, I'd recommend VAST 4.1. Do you have spec sheets from either publisher, or should we go with VAST 4.1 as the default?\n3. **Video size** — What dimensions? 640x360 is standard, 1920x1080 for HD.\n\n**Summary of what we're building:**\n- 2 video placements (one on Hulu, one on Spotify)\n- 15-second pre-roll\n- Crestview Hotels\n\nWhich campaign and what VAST version?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Crestview', description: 'References the advertiser' },
        { type: 'contains', value: 'Hulu', description: 'References Hulu' },
        { type: 'contains', value: 'Spotify', description: 'References Spotify' },
        { type: 'contains', value: 'VAST', description: 'Asks about tag type' },
      ],
    },
    {
      userMessage: 'VAST 4.1 for both. The video is 640x360.',
      description: 'Turn 2: Kiki confirms both placements and shows preview',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "Here are the two video placements I'll create:\n\n**Placement 1 — Hulu:**\n| Field | Value |\n|---|---|\n| Campaign | (pick a Crestview campaign) |\n| Site | Hulu.com |\n| Tag type | VAST 4.1 |\n| Size | 640x360 |\n| Duration | 15s pre-roll |\n| Name | Hulu_Crestview_640x360_Video |\n\n**Placement 2 — Spotify:**\n| Field | Value |\n|---|---|\n| Campaign | (same campaign) |\n| Site | Spotify.com |\n| Tag type | VAST 4.1 |\n| Size | 640x360 |\n| Duration | 15s pre-roll |\n| Name | Spotify_Crestview_640x360_Video |\n\nBoth placements will use VAST 4.1 tags at 640x360 for 15-second pre-roll.\n\nWhich campaign should I put them in? Once you confirm, I'll create them one at a time — starting with whichever you prefer.",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Hulu', description: 'Shows Hulu placement preview' },
        { type: 'contains', value: 'Spotify', description: 'Shows Spotify placement preview' },
        { type: 'contains', value: 'VAST 4.1', description: 'Confirms VAST 4.1 for both' },
        { type: 'contains', value: '640x360', description: 'Confirms video dimensions' },
      ],
    },
    {
      userMessage: 'Create the Hulu placement first',
      description: 'Turn 3: Kiki creates the Hulu video placement',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: "The Hulu video placement has been created:\n\n**Created Successfully:**\n- **Name:** Hulu_Crestview_640x360_Video\n- **Site:** Hulu.com\n- **Tag type:** VAST 4.1\n- **Size:** 640x360\n- **Duration:** 15s pre-roll\n- **Status:** DRAFT (ready for tag generation)\n\nVAST 4.1 tags are ready to generate once you've uploaded the video creative and created the ad linking them.\n\n**Next:** Ready for the Spotify placement? I'll use the same configuration (VAST 4.1, 640x360, 15s pre-roll).",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Hulu', description: 'Confirms Hulu placement created' },
        { type: 'contains', value: 'VAST 4.1', description: 'Confirms VAST 4.1 tag type' },
        { type: 'contains', value: 'Spotify', description: 'Offers to create Spotify next' },
      ],
    },
    {
      userMessage: 'Now the Spotify one',
      description: 'Turn 4: Kiki creates the Spotify video placement',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: "The Spotify video placement has been created:\n\n**Created Successfully:**\n- **Name:** Spotify_Crestview_640x360_Video\n- **Site:** Spotify.com\n- **Tag type:** VAST 4.1\n- **Size:** 640x360\n- **Duration:** 15s pre-roll\n- **Status:** DRAFT (ready for tag generation)\n\n**Both placements are now set up.** Here's the summary:\n\n| Placement | Site | Tag Type | Size |\n|---|---|---|---|\n| Hulu_Crestview_640x360_Video | Hulu.com | VAST 4.1 | 640x360 |\n| Spotify_Crestview_640x360_Video | Spotify.com | VAST 4.1 | 640x360 |\n\n**Remaining steps:**\n1. Upload the 15s video creative (MP4, 640x360)\n2. Create ads linking the creative to each placement\n3. Generate VAST 4.1 tags for both placements\n4. Send the Hulu tag to Hulu's ad ops and the Spotify tag to Spotify's ad ops\n5. QA: verify tags return valid VAST XML\n\nWant me to help with any of these next steps?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Spotify', description: 'Confirms Spotify placement created' },
        { type: 'contains', value: 'Hulu', description: 'Shows summary including Hulu' },
        { type: 'contains', value: 'VAST 4.1', description: 'Both placements confirmed as VAST 4.1' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// FLOW-VT-005: Mixed Display + Video Trafficking
// User has a mixed campaign with both display and video placements
// across different publishers, requiring different tag types.
// ---------------------------------------------------------------------------

const mixedDisplayVideo: ConversationFlow = {
  id: 'FLOW-VT-005',
  name: 'Mixed Display + Video Trafficking',
  description:
    'User traffics a mixed campaign for Meridian Financial with display banners on Forbes and video pre-roll on Hulu, requiring different tag types',
  turns: [
    {
      userMessage: 'Meridian Financial has a mixed campaign — display banners on Forbes + video pre-roll on Hulu',
      description: 'Turn 1: Kiki looks up data for the mixed campaign',
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
            { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            { type: 'tool_use', id: 'tu_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90002' } },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: "I found Meridian Financial, Forbes, and Hulu. Here are Meridian's campaigns:\n\n| Campaign | Dates |\n|---|---|\n| Meridian Q1 2026 | Jan-Mar 2026 |\n| Meridian Q2 2026 | Apr-Jun 2026 |\n| Meridian Q3 2026 | Jul-Sep 2026 |\n\nFor this mixed campaign, we'll need:\n\n**Display on Forbes:**\n- Standard display placement(s)\n- Banner sizes (300x250, 728x90, etc.)\n- JavaScript tags (standard for display)\n\n**Video on Hulu:**\n- Video (IN_STREAM_VIDEO) placement\n- Pre-roll format\n- VAST tags (the standard for video)\n\nBefore we set these up, I need to know:\n1. **Which campaign** to put these in?\n2. **Display sizes for Forbes** — What banner sizes? (300x250 is the safe default)\n3. **Video specs for Hulu** — Size and duration? (640x360, 15s or 30s are standard)\n\nAlso, do you have publisher spec sheets from Forbes and Hulu? Those will confirm the exact tag types and requirements.",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Meridian', description: 'References the advertiser' },
        { type: 'contains', value: 'Forbes', description: 'References Forbes for display' },
        { type: 'contains', value: 'Hulu', description: 'References Hulu for video' },
        { type: 'contains', value: 'VAST', description: 'Mentions VAST for video' },
      ],
    },
    {
      userMessage: 'What tag types do I need for each?',
      description: 'Turn 2: Kiki recommends JavaScript for display and VAST for video',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "Here's exactly what you need for each placement type:\n\n**Forbes — Display Banners:**\n| Setting | Value |\n|---|---|\n| Tag type | **JavaScript** (with iframe fallback) |\n| Placement type | DISPLAY |\n| Sizes | Depends on what you booked (300x250, 728x90, etc.) |\n| Tag delivery | `<script>` snippet sent to Forbes ad ops |\n\nJavaScript is the industry default for display banners. CM360 will generate both a JavaScript tag and an iframe fallback for each placement. Forbes can use whichever their ad server prefers.\n\n**Hulu — Video Pre-roll:**\n| Setting | Value |\n|---|---|\n| Tag type | **VAST** (version depends on Hulu's spec) |\n| Placement type | IN_STREAM_VIDEO |\n| Size | 640x360 or 1920x1080 |\n| Tag delivery | VAST XML URL sent to Hulu ad ops |\n\nVAST is the only tag type that works for in-stream video. Hulu's video player needs a VAST XML URL to fetch and play your video creative.\n\n**Summary:**\n| Publisher | Type | Tag Format |\n|---|---|---|\n| Forbes | Display | JavaScript |\n| Hulu | Video | VAST |\n\nThis is a very standard mixed-media setup. Different tag types for different placement types — just make sure you send the right tags to the right publisher!\n\nDo you have the publisher specs from Forbes and Hulu to confirm?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'JavaScript', description: 'Recommends JavaScript for Forbes display' },
        { type: 'contains', value: 'VAST', description: 'Recommends VAST for Hulu video' },
        { type: 'contains', value: 'Forbes', description: 'Mentions Forbes' },
        { type: 'contains', value: 'Hulu', description: 'Mentions Hulu' },
      ],
    },
    {
      userMessage: "The Forbes spec says JavaScript, Hulu says VAST 4.0 — confirmed",
      description: 'Turn 3: Kiki acknowledges confirmed specs from both publishers',
      mockResponses: [
        {
          content: [
            {
              type: 'text',
              text: "Confirmed specs locked in:\n\n| Publisher | Type | Tag Format | Status |\n|---|---|---|---|\n| Forbes | Display | JavaScript | Confirmed by spec |\n| Hulu | Video (pre-roll) | VAST 4.0 | Confirmed by spec |\n\nNote: Hulu specified VAST 4.0 (not 4.1). That's perfectly fine — VAST 4.0 includes viewability verification and SSAI support, which covers all the premium streaming requirements. The only difference from 4.1 is minor improvements to SSAI tracking and interactive creative references.\n\nI'm ready to create both placements. Just need the final details:\n\n**Forbes display:**\n- Which campaign?\n- What banner size(s)? (300x250, 728x90, etc.)\n\n**Hulu video:**\n- Which campaign? (same or different?)\n- Video size? (640x360 or 1920x1080)\n- Duration? (15s or 30s)\n\nOr do you want me to set up both at once? I can show you a combined preview before creating anything.",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'JavaScript', description: 'Confirms JavaScript for Forbes' },
        { type: 'contains', value: 'VAST 4.0', description: 'Confirms VAST 4.0 for Hulu' },
        { type: 'contains', value: 'Forbes', description: 'References Forbes' },
        { type: 'contains', value: 'Hulu', description: 'References Hulu' },
      ],
    },
    {
      userMessage: 'Set up both placements',
      description: 'Turn 4: Kiki creates or previews both placements',
      mockResponses: [
        {
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
          ],
          stop_reason: 'tool_use',
        },
        {
          content: [
            {
              type: 'text',
              text: "I still need a few details before I can create them. Let me show you what I have and what's missing:\n\n**Placement 1 — Forbes Display:**\n- **Advertiser:** Meridian Financial\n- **Site:** Forbes.com\n- **Tag type:** JavaScript\n- **Size:** Need to confirm (300x250? 728x90? Both?)\n- **Campaign:** Need to confirm\n\n**Placement 2 — Hulu Video:**\n- **Advertiser:** Meridian Financial\n- **Site:** Hulu.com\n- **Tag type:** VAST 4.0\n- **Size:** Need to confirm (640x360 or 1920x1080?)\n- **Duration:** Need to confirm (15s or 30s?)\n- **Campaign:** Need to confirm\n\nCan you fill in the blanks? Once I have the sizes, durations, and campaign, I'll show you a final preview and create both with your approval.\n\nOr if you want the most common defaults: Forbes at 300x250 with JavaScript, Hulu at 640x360 with VAST 4.0 — both in the Q1 campaign. Sound good?",
            },
          ],
          stop_reason: 'end_turn',
        },
      ],
      responseAssertions: [
        { type: 'contains', value: 'Forbes', description: 'Shows Forbes placement details' },
        { type: 'contains', value: 'Hulu', description: 'Shows Hulu placement details' },
        { type: 'contains', value: 'Meridian', description: 'References the advertiser' },
        { type: 'contains', value: 'VAST 4.0', description: 'Maintains VAST 4.0 from spec' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Export all video-trafficking conversation flows
// ---------------------------------------------------------------------------

export const VIDEO_TRAFFICKING_FLOWS: ConversationFlow[] = [
  tagTypeSelection,
  vendorSpecReview,
  vpaidMigration,
  completeVideoTrafficking,
  mixedDisplayVideo,
];
