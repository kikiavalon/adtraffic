/**
 * Video trafficking test prompts (30 total).
 *
 * These test that Kiki can recommend tag types (VAST, VPAID, JS, iframe),
 * handle vendor spec documents, confirm tag types with users, and set up
 * video placements correctly.
 *
 * Sub-categories:
 *   A. Tag Type Knowledge               (VT-001 to VT-006)
 *   B. Tag Type Recommendations          (VT-007 to VT-012)
 *   C. Vendor Spec Document Handling     (VT-013 to VT-018)
 *   D. Video Placement Setup             (VT-019 to VT-024)
 *   E. Tag Type Confirmation & Edge Cases(VT-025 to VT-030)
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
// A. Tag Type Knowledge (VT-001 to VT-006)
// ---------------------------------------------------------------------------

const tagTypeKnowledge: TestPrompt[] = [
  {
    id: 'VT-001',
    prompt: 'What tag types does CM360 support?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Lists the tag types CM360 supports: VAST, VPAID, JavaScript, iframe, etc.',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 supports several tag types depending on the placement type and publisher requirements:\n\n**Display tags:**\n- **JavaScript** — The most common display tag. It\'s a `<script>` snippet that calls CM360\'s ad server and renders the creative in-page. Supports click tracking, viewability, and rich media features.\n- **iframe** — A simpler fallback tag that loads the ad in an isolated frame. Used when JavaScript isn\'t supported or for added security sandboxing.\n\n**Video tags:**\n- **VAST** (Video Ad Serving Template) — The industry-standard XML-based tag for video ads. Used for in-stream pre-roll, mid-roll, and post-roll. Versions 2.0, 3.0, 4.0, and 4.1 are supported.\n- **VPAID** (Video Player Ad Interface Definition) — An older standard for interactive video ads. Allows the ad creative to communicate with the video player. Being phased out by many publishers in favor of SIMID.\n\n**Other formats:**\n- **Tracking tags** — Impression and click tracking pixels (1x1 images or JavaScript beacons)\n- **Internal redirect tags** — Used for server-to-server tag chaining between ad servers\n\nThe right tag type depends on what the publisher accepts and whether the placement is display or video. Want me to help you figure out which one to use?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Lists VAST tag type' },
      { type: 'contains', value: 'JavaScript', description: 'Lists JavaScript tag type' },
      { type: 'contains', value: 'iframe', description: 'Lists iframe tag type' },
    ],
  },
  {
    id: 'VT-002',
    prompt: "What's the difference between VAST and VPAID?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains VAST is a standard XML tag for video ads, VPAID adds interactivity layer',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Great question — they serve different purposes in the video ad ecosystem:\n\n**VAST** (Video Ad Serving Template):\n- An XML-based protocol that tells a video player *what* to show and *how* to track it\n- Handles: creative URLs, click-through URLs, impression tracking, companion ads\n- The video player controls the experience — play, pause, skip, etc.\n- Simple, reliable, and universally supported\n- Current versions: 2.0, 3.0, 4.0, 4.1\n\n**VPAID** (Video Player Ad Interface Definition):\n- A JavaScript API layer that sits *on top of* VAST\n- Gives the ad creative control over the player — enabling interactive features like expandable overlays, quizzes, product carousels, and custom controls\n- The ad itself can manipulate playback, resize the player, and report custom events\n- Higher security risk because the ad runs arbitrary JavaScript inside the player\n\n**Key differences:**\n| | VAST | VPAID |\n|---|---|---|\n| Format | XML | JavaScript API |\n| Interactivity | None — player controls everything | Full — ad controls the experience |\n| Security | Low risk | Higher risk (arbitrary JS execution) |\n| Publisher support | Universal | Declining — many publishers are dropping it |\n| Replacement | N/A | SIMID (Secure Interactive Media Interface Definition) |\n\n**Bottom line:** Use VAST unless you specifically need interactive ad features. If you do need interactivity, check with the publisher first — many have stopped accepting VPAID due to security concerns, and SIMID is the emerging replacement.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Explains VAST' },
      { type: 'contains', value: 'VPAID', description: 'Explains VPAID' },
      { type: 'contains', value: 'interactive', description: 'Mentions interactivity as key differentiator' },
    ],
  },
  {
    id: 'VT-003',
    prompt: 'When should I use VAST vs JavaScript tags?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains VAST is for video placements, JavaScript is for display placements',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'The choice between VAST and JavaScript tags comes down to what type of placement you\'re working with:\n\n**Use VAST tags for video placements:**\n- Pre-roll, mid-roll, and post-roll video ads\n- Ads that play inside a video player (in-stream)\n- Connected TV (CTV) and OTT placements\n- Any placement where the publisher\'s video player needs to fetch and play your video creative\n\nVAST is an XML-based protocol designed specifically for video. The publisher\'s video player reads the VAST XML to know what video to play, what tracking pixels to fire, and where to send the user on click.\n\n**Use JavaScript tags for display placements:**\n- Standard banner ads (300x250, 728x90, etc.)\n- Rich media and HTML5 ads\n- Native ad slots on web pages\n- Any placement that renders directly in the page (not inside a video player)\n\nJavaScript tags are `<script>` snippets that call CM360\'s ad server and render the creative inline on the page.\n\n**Quick rule of thumb:**\n- If the ad plays in a **video player** → VAST\n- If the ad appears on a **web page** as a banner or display unit → JavaScript\n\nThe publisher\'s spec sheet will usually tell you exactly which format they need. When in doubt, ask — sending the wrong tag type will cause the ad to fail silently.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Explains when to use VAST' },
      { type: 'contains', value: 'video', description: 'Ties VAST to video' },
      { type: 'contains', value: 'JavaScript', description: 'Explains when to use JavaScript' },
    ],
  },
  {
    id: 'VT-004',
    prompt: 'What VAST versions are supported?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Lists supported VAST versions and differences between them',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'CM360 supports multiple VAST versions. Here\'s a breakdown:\n\n| Version | Status | Key Features |\n|---|---|---|\n| **VAST 2.0** | Supported (legacy) | Basic linear/non-linear ads, companion ads, tracking events. Still widely used but limited. |\n| **VAST 3.0** | Supported | Added ad pods (multiple ads in sequence), better error reporting, skippable ads, industry icon support. |\n| **VAST 4.0** | Supported | Mezzanine file support, verification resources (viewability), separate tracking for server-side ad insertion (SSAI). |\n| **VAST 4.1** | Supported (recommended) | Improved SSAI support, better verification, interactive creative file support, most feature-complete. |\n\n**Which version should you use?**\n\n- **Default recommendation: VAST 4.1** — It\'s the most current and feature-rich. Use this unless the publisher specifies otherwise.\n- **If the publisher says VAST 3.0** — That\'s fine. VAST is backward-compatible, but you\'ll miss some newer tracking and verification features.\n- **If the publisher says VAST 2.0** — Still works, but you lose ad pod support, skippability controls, and advanced error reporting.\n\nAlways check the publisher spec sheet for which version they accept. Some older video players only support up to 3.0, and sending a 4.1 tag to a 2.0-only player could cause parsing failures.\n\nCM360 generates the VAST XML automatically based on the placement setup — you just need to know which version the publisher expects.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Discusses VAST versions' },
      { type: 'contains', value: '4.1', description: 'Mentions VAST 4.1' },
      { type: 'contains', value: '2.0', description: 'Mentions VAST 2.0' },
    ],
  },
  {
    id: 'VT-005',
    prompt: 'Is VPAID still widely accepted by publishers?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains VPAID is declining and being replaced by SIMID',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'Short answer: no — VPAID is declining rapidly and many major publishers no longer accept it.\n\n**Why VPAID is being phased out:**\n- **Security risks** — VPAID ads execute arbitrary JavaScript inside the video player, which opens the door to malware, data harvesting, and ad fraud\n- **Performance issues** — VPAID ads often cause latency, buffering, and poor user experience because the ad takes control of the video player\n- **Measurement problems** — Because VPAID ads control their own environment, viewability and verification tools can\'t always measure them accurately\n- **Publisher frustration** — Many publishers have had bad experiences with VPAID ads crashing their players or degrading the viewing experience\n\n**Who\'s dropped VPAID:**\n- Google (including YouTube) deprecated VPAID support\n- Many premium publishers (Hulu, major broadcast networks) have stopped accepting it\n- The IAB Tech Lab itself has recommended moving to SIMID as the replacement\n\n**What replaced it:**\n- **SIMID** (Secure Interactive Media Interface Definition) — provides interactive ad capabilities in a sandboxed, secure environment. The ad runs in an iframe alongside the video player rather than inside it, so it can\'t hijack the player or compromise security.\n\n**My recommendation:** Unless you have a specific, confirmed need for VPAID from a publisher that still supports it, use VAST instead. If you need interactivity, ask the publisher if they support SIMID.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VPAID', description: 'Discusses VPAID status' },
      { type: 'contains', value: 'SIMID', description: 'Mentions SIMID as replacement' },
    ],
  },
  {
    id: 'VT-006',
    prompt: "What's an iframe tag and when would I use one?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains iframe tags as sandboxed alternatives to JavaScript tags',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'An **iframe tag** is a simpler, more secure alternative to a JavaScript tag for display ads.\n\n**How it works:**\nThe tag creates an inline frame (`<iframe>`) element on the publisher\'s page. This frame loads the ad from CM360\'s servers in a completely isolated environment — the ad runs inside its own mini-page that\'s separate from the publisher\'s content.\n\n```html\n<iframe src="https://ad.doubleclick.net/ddm/..." width="300" height="250" frameborder="0"></iframe>\n```\n\n**When to use iframe tags:**\n- **Security-conscious publishers** — The iframe creates a sandbox that prevents the ad from accessing the publisher\'s page DOM, cookies, or JavaScript. This is why some publishers require iframe tags over JavaScript tags.\n- **JavaScript-restricted environments** — Some environments block third-party JavaScript execution but allow iframes\n- **As a fallback** — It\'s common practice to provide both a JavaScript tag (primary) and an iframe tag (fallback) to publishers\n- **Simple static ads** — If the creative is just an image banner, an iframe works perfectly\n\n**Tradeoffs vs. JavaScript tags:**\n| | JavaScript Tag | iframe Tag |\n|---|---|---|\n| Rich media support | Full | Limited |\n| Click tracking | Automatic | Requires redirect-based tracking |\n| Viewability measurement | Better | More limited |\n| Security | Runs in page context | Isolated in a secure sandbox |\n| Expandable ads | Supported | Not supported |\n\n**Bottom line:** JavaScript tags are the default for display. Use iframe tags when the publisher specifically requests them for security or compatibility reasons, or as a fallback alongside the JavaScript tag.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'iframe', description: 'Defines iframe tag' },
      { type: 'contains', value: 'sandbox', description: 'Mentions sandbox/isolation' },
    ],
  },
];

// ---------------------------------------------------------------------------
// B. Tag Type Recommendations (VT-007 to VT-012)
// ---------------------------------------------------------------------------

const tagTypeRecommendations: TestPrompt[] = [
  {
    id: 'VT-007',
    prompt: 'I need to generate tags for a video placement on Hulu',
    category: 'video-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_sites'],
    expectedBehavior: 'Looks up Hulu site, then asks the user which tag type and which campaign/advertiser',
    mockToolSequence: [
      {
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'cm360_list_profiles', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_2', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'Hulu' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: 'I found Hulu.com in the account. Before I generate video tags, I need to confirm a few things:\n\n1. **Which advertiser and campaign** is this for?\n2. **What tag type would you like?** For video placements on Hulu, VAST is the standard. Which VAST version does the publisher spec call for? Common options:\n   - VAST 4.1 (recommended)\n   - VAST 4.0\n   - VAST 3.0\n\nIf you have a publisher spec from Hulu, that will tell us exactly which format and version they need. Otherwise, I\'d recommend VAST 4.1 as the default.\n\nWhich advertiser are we working with?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'tag type', description: 'Asks about tag type' },
      { type: 'contains', value: 'which', description: 'Asks user to confirm details' },
    ],
  },
  {
    id: 'VT-008',
    prompt: 'Generate VAST tags for the first Apex Motors campaign',
    category: 'video-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Resolves Apex Motors, finds first campaign, lists placements, discusses VAST tags',
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
          {
            type: 'text',
            text: 'I found the first Apex Motors campaign: **Apex Q1 2026 Display Awareness**.\n\nI can see the placements in this campaign. However, these are currently display-type placements. To generate VAST tags, we\'d need video (IN_STREAM_VIDEO) placements.\n\nHere are your options:\n1. **Generate standard JavaScript/iframe tags** for the existing display placements\n2. **Create new video placements** in this campaign with VAST tag format\n3. **Check the Q2 campaign** (Apex Q2 2026 Video Conversions) which may have video placements\n\nWhich would you prefer?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'References VAST tag format' },
      { type: 'contains', value: 'Apex', description: 'References Apex Motors' },
    ],
  },
  {
    id: 'VT-009',
    prompt: 'What tag type should I use for a pre-roll video ad on ESPN?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends VAST for in-stream pre-roll video',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'For a pre-roll video ad on ESPN, you should use **VAST** tags.\n\nHere\'s why:\n- **Pre-roll** is an in-stream video format — the ad plays before the main video content in ESPN\'s video player\n- VAST (Video Ad Serving Template) is the universal standard for in-stream video ad delivery\n- ESPN\'s video player will read the VAST XML to fetch your video creative, fire tracking events, and handle click-throughs\n\n**Recommended version:** VAST 4.1 (unless ESPN\'s spec says otherwise — some publishers cap at 3.0 or 4.0)\n\n**Common pre-roll specs for ESPN-type publishers:**\n- Duration: 15s or 30s\n- Sizes: 640x360 or 1920x1080\n- File size: usually under 10-15MB\n- Format: MP4 (H.264)\n\nDo you have ESPN\'s trafficking spec sheet? That would confirm the exact VAST version, max duration, and file size requirements. If not, VAST 4.1 with a 15s or 30s video at 640x360 is a safe default for most publishers.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Recommends VAST' },
      { type: 'contains', value: 'pre-roll', description: 'References pre-roll format' },
      { type: 'contains', value: 'in-stream', description: 'Explains in-stream context' },
    ],
  },
  {
    id: 'VT-010',
    prompt: "The publisher says they only accept VAST 2.0 — is that a problem?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains VAST 2.0 is supported but has limitations compared to newer versions',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'VAST 2.0 is fully supported in CM360, so you can absolutely generate VAST 2.0 tags for this publisher. It\'s not a problem — it will work.\n\nThat said, here\'s what you should know about the limitations compared to newer versions:\n\n**What VAST 2.0 supports:**\n- Linear video ads (pre-roll, mid-roll, post-roll)\n- Non-linear overlays\n- Companion ads\n- Basic tracking events (start, firstQuartile, midpoint, thirdQuartile, complete, click)\n\n**What you lose vs. VAST 3.0+:**\n- No ad pod support (can\'t sequence multiple ads back-to-back)\n- No skippable ad controls\n- No industry icon support (AdChoices overlay)\n- Limited error reporting\n\n**What you lose vs. VAST 4.0+:**\n- No mezzanine file support\n- No verification/viewability resources\n- No server-side ad insertion (SSAI) support\n\nFor a standard pre-roll or mid-roll video ad, VAST 2.0 will work fine. You just won\'t have access to the newer features. Generate the tags as VAST 2.0 per the publisher spec and you\'re good to go.\n\nWant me to set up the placement with VAST 2.0?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST 2.0', description: 'Addresses the specific version' },
      { type: 'not_contains', value: 'not supported', description: 'Does not say VAST 2.0 is unsupported' },
    ],
  },
  {
    id: 'VT-011',
    prompt: 'I want to serve an interactive video ad that expands on hover',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Discusses VPAID/SIMID for interactivity, warns about publisher support',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'An interactive video ad that expands on hover would traditionally have required **VPAID** tags — that\'s the standard that gives ad creatives control over the video player for interactive features like expansion, overlays, and custom controls.\n\nHowever, there\'s an important caveat: **many publishers have stopped accepting VPAID** due to security and performance concerns. Before committing to this approach, you\'ll need to check with the publisher whether they still support VPAID.\n\n**Your options:**\n\n1. **VPAID** (if the publisher accepts it)\n   - Full interactivity: expand, resize, custom controls, overlays\n   - Declining support across the industry\n   - Higher risk of being blocked or causing player issues\n\n2. **SIMID** (Secure Interactive Media Interface Definition)\n   - The newer, more secure replacement for VPAID\n   - Provides interactive features in a sandboxed iframe\n   - Growing publisher support, but not yet universal\n\n3. **VAST + companion ad**\n   - Use a standard VAST video tag with an interactive companion banner\n   - The companion can be a rich media HTML5 unit that expands on hover\n   - Works with publishers who don\'t accept VPAID\n\n**My recommendation:** Check with the publisher first about VPAID/SIMID support. If they don\'t accept either, option 3 (VAST + interactive companion) gives you the closest experience while staying compatible.\n\nWhich publisher is this for? I can help you figure out the right approach.',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VPAID', description: 'Mentions VPAID for interactivity' },
      { type: 'contains', value: 'publisher', description: 'Warns about publisher support' },
    ],
  },
  {
    id: 'VT-012',
    prompt: 'Default tags for a standard display placement — what format?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends JavaScript tags as the default for standard display',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: 'For a standard display placement, the default tag format is **JavaScript**.\n\nHere\'s the breakdown:\n\n**JavaScript tag (primary):**\n```html\n<script src="https://ad.doubleclick.net/ddm/trackimp/..."></script>\n```\n- This is the standard, most common display tag format in CM360\n- Supports rich media, click tracking, viewability measurement, and expandable ads\n- Works on desktop and mobile web\n\n**iframe tag (fallback):**\n```html\n<iframe src="https://ad.doubleclick.net/ddm/..." width="300" height="250"></iframe>\n```\n- Provided alongside the JavaScript tag as a backup\n- Used when the publisher or environment doesn\'t allow third-party JavaScript\n\n**Best practice:** When you generate tags for a display placement, CM360 will produce both a JavaScript tag and an iframe tag. Send both to the publisher — they\'ll use the JavaScript tag by default and fall back to the iframe if needed.\n\nWould you like me to generate tags for a specific placement?',
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'JavaScript', description: 'Recommends JavaScript as default' },
      { type: 'contains', value: 'display', description: 'Contextualizes for display placement' },
    ],
  },
];

// ---------------------------------------------------------------------------
// C. Vendor Spec Document Handling (VT-013 to VT-018)
// ---------------------------------------------------------------------------

const vendorSpecHandling: TestPrompt[] = [
  {
    id: 'VT-013',
    prompt: "I have a spec sheet from ESPN for our video campaign — can you review it?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Asks the user to share or upload the spec document',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Absolutely — I'd be happy to review ESPN's spec sheet! Please share or upload the document and I'll extract the key trafficking requirements.\n\nHere's what I'll be looking for:\n- **Tag type and version** (VAST 3.0, VAST 4.1, etc.)\n- **Video duration limits** (15s, 30s, 60s)\n- **Creative dimensions** (640x360, 1920x1080, etc.)\n- **File size maximums**\n- **File format requirements** (MP4, WebM, etc.)\n- **Companion ad specs** (if applicable)\n- **SSL requirements**\n- **Any special trafficking instructions**\n\nGo ahead and send the spec — I'll summarize the requirements and we can set up the placements to match.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'share', description: 'Asks user to share the document' },
      { type: 'contains', value: 'spec', description: 'References the spec document' },
    ],
  },
  {
    id: 'VT-014',
    prompt: 'The publisher spec says: VAST 4.1, max 30s, 1920x1080, 15MB max file size',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Summarizes and confirms the publisher spec requirements',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Got it! Here's a summary of the publisher's video trafficking requirements:\n\n**Publisher Spec Summary:**\n| Requirement | Value |\n|---|---|\n| Tag Type | VAST 4.1 |\n| Max Duration | 30s (30 seconds) |\n| Dimensions | 1920x1080 (Full HD) |\n| Max File Size | 15MB |\n\nThese are solid, standard requirements. A few things to keep in mind:\n\n- **VAST 4.1** is the latest version — great for tracking and verification features\n- **30s max** means you can run 15s or 30s creatives (15s is more common for pre-roll)\n- **1920x1080** is Full HD resolution — make sure your video creative is rendered at this resolution. If you have a 640x360 version, it won't match this spec.\n- **15MB** is generous — most 30s video ads at 1080p come in under 10MB with proper compression\n\nShall I set up the placement to match these specs? I'll need to know:\n1. Which advertiser and campaign?\n2. Which site is this for?\n\nOr if you've already mentioned those details, just confirm and I'll get the placement configured.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST 4.1', description: 'Captures tag type from spec' },
      { type: 'contains', value: '30s', description: 'Captures duration requirement' },
      { type: 'contains', value: '1920x1080', description: 'Captures dimension requirement' },
    ],
  },
  {
    id: 'VT-015',
    prompt: "What should I look for in a publisher's trafficking spec?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Lists key fields to look for in a publisher spec document',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Great question — a publisher's trafficking spec (sometimes called a \"media kit\" or \"ad spec sheet\") contains everything you need to set up placements correctly. Here's what to look for:\n\n**Must-have information:**\n\n1. **Tag type** — the tag type (VAST and which version: 2.0, 3.0, 4.0, 4.1), JavaScript, iframe, or VPAID. This is the most critical field for video trafficking.\n\n2. **Creative dimensions** — The exact pixel size (e.g., 640x360, 1920x1080 for video; 300x250, 728x90 for display)\n\n3. **File size limits** — Maximum file size in KB or MB (e.g., 15MB for video, 200KB for display)\n\n4. **Duration limits** — For video: max length in seconds (commonly 15s, 30s, or 60s)\n\n5. **File formats accepted** — MP4 (H.264), WebM, GIF, HTML5, etc.\n\n**Important but sometimes missing:**\n\n6. **SSL/HTTPS requirements** — Most publishers now require SSL-compliant tags\n7. **Third-party tracking** — Whether they accept third-party impression/click trackers\n8. **Companion ad specs** — If they support companion banners alongside video\n9. **VPAID/SIMID support** — For interactive video\n10. **Ad pod rules** — Whether they allow sequential ads\n\n**Nice-to-have:**\n11. Viewability measurement vendor requirements\n12. Frequency capping guidance\n13. Trafficking deadlines and lead times\n14. Publisher contact for ad ops questions\n\nIf the publisher doesn't provide a spec, ask for one — trafficking without a spec is guesswork and often leads to rejected tags or broken creatives.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'tag type', description: 'Lists tag type as key field' },
      { type: 'contains', value: 'file size', description: 'Lists file size as key field' },
    ],
  },
  {
    id: 'VT-016',
    prompt: "Bloomberg sent their media kit — they want JavaScript tags for display and VAST 3.0 for video",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Acknowledges the requirements from Bloomberg',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Perfect — I've noted Bloomberg's requirements:\n\n**Bloomberg Trafficking Specs:**\n| Placement Type | Tag Format |\n|---|---|\n| Display | JavaScript tags |\n| Video | VAST 3.0 |\n\nThis is a very common setup. A few things to confirm:\n\n**For display (JavaScript tags):**\n- Standard display tags are the default in CM360, so no special configuration needed\n- I'll generate both JavaScript (primary) and iframe (fallback) tags\n\n**For video (VAST 3.0):**\n- VAST 3.0 is well-supported — it includes ad pod support and skippable ad controls\n- Note: VAST 3.0 doesn't include the verification resources that 4.0+ has, so if you need third-party viewability measurement, check if Bloomberg accepts VAST 4.0+\n- I'll configure the video placements with VAST 3.0 tag format\n\n**Next steps:**\nWhich advertiser and campaign is the Bloomberg buy for? Once I know that, I can set up both the display and video placements to match their spec.\n\nDo you also have the specific sizes, durations, and file size limits from the Bloomberg media kit?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'JavaScript', description: 'Acknowledges JavaScript for display' },
      { type: 'contains', value: 'VAST 3.0', description: 'Acknowledges VAST 3.0 for video' },
      { type: 'contains', value: 'Bloomberg', description: 'References the publisher by name' },
    ],
  },
  {
    id: 'VT-017',
    prompt: "I don't have the publisher spec yet — can I still set up the placements?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Advises caution and recommends getting the spec before finalizing',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "You can start the setup, but I'd strongly recommend getting the spec before finalizing and generating tags. Here's why:\n\n**What you can do now:**\n- Create the campaign (if it doesn't exist yet)\n- Set up the basic placement structure (advertiser, site, dates)\n- Upload creatives if you have them\n\n**What you should wait for the spec to confirm:**\n- **Tag type** — JavaScript vs. VAST (and which VAST version). Generating the wrong tag type means the publisher can't use them.\n- **Creative dimensions and file size** — If the spec says 640x480 and you've set up 1920x1080, you'll need to redo the creative.\n- **Duration limits** — A 30s ad won't work if the publisher caps at 15s.\n- **SSL and tracking requirements** — Some publishers have specific compliance requirements.\n\n**My recommendation:** Set up everything except the final tag generation. Once you get the publisher spec, we can confirm the tag type and dimensions match, then generate the tags.\n\nThis way you're not blocked — you've done the prep work — but you avoid sending tags that don't match the publisher's requirements.\n\nWant to go ahead and start the setup? Which advertiser and site are we working with?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'spec', description: 'Recommends getting the spec' },
      { type: 'contains', value: 'tag type', description: 'Highlights tag type as spec-dependent' },
      { type: 'not_contains', value: 'cm360_create', description: 'Does not jump to creating without spec' },
    ],
  },
  {
    id: 'VT-018',
    prompt: 'The CNN spec requires SSL-compliant tags only',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Confirms SSL/HTTPS compliance for CNN tags',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Good news — CM360 generates SSL-compliant (HTTPS) tags by default, so CNN's requirement is automatically met.\n\nHere's what SSL compliance means for trafficking:\n\n- All tag URLs use `https://` instead of `http://`\n- Creative assets must also be served over HTTPS\n- Any third-party tracking pixels included in the tags must use HTTPS\n- Landing page redirects go through CM360's secure click tracker\n\n**What to double-check:**\n- If you're including any **third-party tracking pixels** (from viewability vendors, brand safety tools, etc.), make sure those URLs are also HTTPS. A single non-secure pixel can cause the browser to flag the entire ad as mixed content.\n- If the creative references any external assets (fonts, scripts, images), those must also be HTTPS.\n\n**For CNN specifically:**\nThis is a standard requirement from premium publishers. CNN, like most major news sites, enforces HTTPS across their entire domain. Tags with non-secure elements will be rejected or blocked by the browser.\n\nWhen I generate tags for CNN placements, they'll be SSL-compliant by default. Is there anything else from the CNN spec you'd like to review?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'SSL', description: 'Addresses SSL requirement' },
      { type: 'contains', value: 'CNN', description: 'References CNN by name' },
    ],
  },
];

// ---------------------------------------------------------------------------
// D. Video Placement Setup (VT-019 to VT-024)
// ---------------------------------------------------------------------------

const videoPlacementSetup: TestPrompt[] = [
  {
    id: 'VT-019',
    prompt: 'Create a video placement on Hulu for Vanguard Athletics, pre-roll 640x360',
    category: 'video-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_sites', 'cm360_list_campaigns'],
    expectedBehavior: 'Gathers advertiser, site, and campaign data, then asks about tag type and duration',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'Hulu' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90004' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: "I found Vanguard Athletics and Hulu. Here are the Vanguard campaigns:\n\n| Campaign | Dates |\n|---|---|\n| Vanguard Q1 2026 | Jan-Mar 2026 |\n| Vanguard Q2 2026 | Apr-Jun 2026 |\n| Vanguard Q3 2026 | Jul-Sep 2026 |\n\nBefore I create the 640x360 video placement on Hulu, I need to confirm a couple of things:\n\n1. **Which campaign** should this placement go in?\n2. **Tag type** — For a pre-roll video on Hulu, I'd recommend VAST 4.1 unless you have a specific version from Hulu's spec. Which VAST version?\n3. **Duration** — What's the video length? (15s and 30s are standard for pre-roll)\n\nOnce you confirm these details, I'll show you a preview before creating it.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'video', description: 'References video placement' },
      { type: 'contains', value: 'VAST', description: 'Asks about VAST tag type' },
      { type: 'contains', value: 'Vanguard', description: 'References the advertiser' },
    ],
  },
  {
    id: 'VT-020',
    prompt: 'What video sizes should I use for in-stream pre-roll?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Lists common video ad sizes for in-stream pre-roll',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "For in-stream pre-roll video ads, the most common sizes are:\n\n| Size | Name | When to Use |\n|---|---|---|\n| **640x360** | SD 16:9 | Most common pre-roll size. Works on desktop and mobile. Safe default if the publisher doesn't specify. |\n| **640x480** | SD 4:3 | Used by some publishers with 4:3 aspect ratio players. Less common now but still seen. |\n| **1920x1080** | Full HD 16:9 | Premium placements, CTV, and high-quality video experiences. Required by some premium publishers. |\n| **1280x720** | HD 720p | Mid-tier quality. Good balance between file size and resolution. |\n| **320x180** | Mobile 16:9 | Mobile-specific pre-roll. Smaller file size for mobile bandwidth. |\n\n**My recommendation:**\n- **Start with 640x360** — it's the industry standard for pre-roll and is accepted by virtually every publisher and video player\n- **Add 1920x1080** if the publisher spec calls for HD or if you're running on CTV/premium inventory\n- **Check the publisher spec** — they'll tell you exactly which size(s) they accept\n\nNote: Unlike display ads where the size must exactly match the ad slot, video players are more flexible — they can scale video content. But it's still best practice to match the publisher's recommended dimensions for the best visual quality.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '640', description: 'Lists standard 640px video size' },
      { type: 'contains', value: 'in-stream', description: 'References in-stream context' },
    ],
  },
  {
    id: 'VT-021',
    prompt: 'Set up a companion banner alongside my video placement',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains companion banners and common sizes',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "A companion banner is a display ad that appears alongside a video ad — typically next to or below the video player. It reinforces the video ad's message and stays visible after the video ends.\n\n**How companion ads work in CM360:**\n- The companion is a separate display placement that's linked to the video placement\n- When the video ad plays, the companion banner renders simultaneously in its designated slot on the page\n- The VAST tag for the video includes a reference to the companion creative\n\n**Common companion banner sizes:**\n| Size | Position |\n|---|---|\n| **300x250** | Most popular — appears in the sidebar next to the video player |\n| **728x90** | Leaderboard below the video player |\n| **300x60** | Small strip below the video player |\n| **970x90** | Wide banner above or below the player (premium) |\n\n**To set this up, I'll need:**\n1. Which video placement is this a companion for?\n2. Which companion size? (300x250 is the safe default)\n3. Do you have the companion creative ready?\n\nThe 300x250 Medium Rectangle is the most universally accepted companion size. Most publishers that support companion ads will accept it.\n\nWhich video placement would you like to add a companion to?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'companion', description: 'Explains companion concept' },
      { type: 'contains', value: '300x250', description: 'Lists common companion size' },
    ],
  },
  {
    id: 'VT-022',
    prompt: "What's the difference between in-stream and out-stream video?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains in-stream vs out-stream video placement types',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Great question — they're fundamentally different in where and how the video ad appears. In short, in-stream plays inside a video player while out-stream appears on a web page.\n\n**In-Stream video:**\n- Plays **inside an existing video player** as part of a content viewing experience\n- Examples: pre-roll before a YouTube video, mid-roll during a Hulu show, post-roll after an ESPN highlight\n- The user is already watching video content — your ad plays in the same player\n- **Types:** pre-roll (before content), mid-roll (during content), post-roll (after content)\n- **Tag format:** VAST (the video player reads the VAST XML to fetch and play your ad)\n- **In CM360:** Placement type = `IN_STREAM_VIDEO`\n\n**Out-stream (or outstream) video:**\n- Plays **outside of a video player**, embedded within editorial content on a web page\n- Examples: a video ad that auto-plays in the middle of a news article, or a video that expands when scrolled into view\n- The user is reading text content — your video ad appears between paragraphs or in the sidebar\n- Usually auto-plays muted and expands on user interaction\n- **Tag format:** Can be VAST (delivered via a JavaScript wrapper) or a custom rich media unit\n- **In CM360:** May use `DISPLAY` placement type with a video creative, or a specialized outstream tag\n\n**Key differences:**\n| | In-stream | Out-stream |\n|---|---|---|\n| Context | Inside a video player | On a web page (no player) |\n| User intent | Watching video | Reading content |\n| Completion rates | Higher (captive audience) | Lower (user may scroll past) |\n| Sound | Usually on | Usually muted by default |\n| Publisher requirement | Must have video content | Any page with content |\n\nWhich type are you looking to set up?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'in-stream', description: 'Explains in-stream' },
      { type: 'contains', value: 'outstream', description: 'Explains out-stream' },
    ],
  },
  {
    id: 'VT-023',
    prompt: 'I need a 15-second pre-roll ad on Spotify for Luminance Beauty',
    category: 'video-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_sites', 'cm360_list_campaigns'],
    expectedBehavior: 'Looks up data and presents a placement preview',
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
          { type: 'tool_use', id: 'tu_3', name: 'cm360_list_sites', input: { profileId: '12345', searchString: 'Spotify' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_campaigns', input: { profileId: '12345', advertiserId: '90001' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: "I found Luminance Beauty and Spotify. Here's what I have:\n\n**Luminance Beauty Campaigns:**\n| Campaign | Dates |\n|---|---|\n| Luminance Q1 2026 | Jan-Mar 2026 |\n| Luminance Q2 2026 | Apr-Jun 2026 |\n| Luminance Q3 2026 | Jul-Sep 2026 |\n\n**Proposed Placement Preview:**\n- **Advertiser:** Luminance Beauty\n- **Site:** Spotify\n- **Type:** Video (pre-roll)\n- **Duration:** 15 seconds\n- **Size:** 640x360 (standard pre-roll)\n- **Tag format:** VAST 4.1 (recommended for Spotify)\n\nI need to know:\n1. **Which campaign** should this go in?\n2. Does the Spotify spec confirm VAST 4.1, or do they require a different version?\n\nOnce you pick the campaign, I'll finalize the preview and create it after your approval.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: '15', description: 'References 15-second duration' },
      { type: 'contains', value: 'Spotify', description: 'References Spotify' },
      { type: 'contains', value: 'Luminance', description: 'References Luminance Beauty' },
    ],
  },
  {
    id: 'VT-024',
    prompt: 'Can I use the same creative for both a 640x360 and 1920x1080 placement?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains size mismatch and transcoding considerations',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Technically, video players can scale content up or down, so a single video creative *can* play in both a 640x360 and 1920x1080 placement. However, there are important quality considerations:\n\n**Scaling down (1920x1080 creative → 640x360 placement):**\n- Works well — the player downscales the HD video\n- Slight bandwidth waste (the user downloads a larger file than needed)\n- Visually looks fine\n\n**Scaling up (640x360 creative → 1920x1080 placement):**\n- Works, but **the video will look blurry and pixelated** on HD screens\n- Particularly noticeable on CTV/large screens where users expect HD quality\n- Not recommended for premium placements\n\n**Best practice — use transcoded versions:**\nIdeal workflow is to provide your video creative at the highest resolution (1920x1080) and then create transcoded versions at each target size:\n- 1920x1080 (for HD/CTV placements)\n- 640x360 (for standard web placements)\n- 320x180 (for mobile placements)\n\nMany creative teams deliver multiple renditions automatically. If you only have one size, here's my recommendation:\n- If you have 1920x1080 → use it everywhere (it'll downscale gracefully)\n- If you only have 640x360 → use it for standard web, but get an HD version for any 1920x1080 or CTV placements\n\nWould you like me to set up placements at both sizes?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'resolution', description: 'Discusses resolution differences' },
      { type: 'contains', value: 'transcode', description: 'Mentions transcoding as best practice' },
    ],
  },
];

// ---------------------------------------------------------------------------
// E. Tag Type Confirmation & Edge Cases (VT-025 to VT-030)
// ---------------------------------------------------------------------------

const tagTypeConfirmation: TestPrompt[] = [
  {
    id: 'VT-025',
    prompt: "Generate tags — I'll let you pick the best format",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Does NOT just pick a format — asks the user to confirm before proceeding',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "I appreciate the trust, but before I generate tags, I'd like to confirm which tag type you need. The tag type should be based on the publisher's requirements, not my best guess. Let me help you figure it out.\n\nA few questions:\n\n1. **What type of placement is this?**\n   - **Display** (banner on a web page) → I'd recommend JavaScript tags\n   - **Video** (pre-roll, mid-roll in a video player) → I'd recommend VAST 4.1\n\n2. **Which publisher/site** is this for? If you have their spec sheet, it'll tell us the exact tag type and version they accept.\n\n3. **Which advertiser and campaign** are we generating tags for?\n\nThe reason I'm asking rather than just picking: if I generate VAST tags but the publisher expects JavaScript (or vice versa), the tags won't work and you'll need to regenerate. It's a quick question now that saves a round of back-and-forth with the publisher later.\n\nWhat are we working with?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'confirm', description: 'Asks user to confirm rather than guessing' },
      { type: 'contains', value: 'VAST', description: 'Mentions VAST as an option' },
    ],
  },
  {
    id: 'VT-026',
    prompt: 'The client insists on VPAID tags — what should I tell them?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains VPAID is declining and recommends discussing alternatives',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "This is a common situation. Here's how I'd approach the conversation with the client:\n\n**The reality about VPAID:**\n- Publisher acceptance of VPAID is declining — it is being actively phased out across the industry\n- Many major publishers (including Google/YouTube, Hulu, and most premium video platforms) have stopped accepting VPAID tags\n- The IAB Tech Lab itself has recommended migrating to SIMID as the replacement\n\n**What to tell the client:**\n\n1. **Acknowledge their goal:** \"I understand you want interactive video capabilities — that's a great creative strategy.\"\n\n2. **Explain the publisher landscape:** \"Many of the publishers on our media plan no longer accept VPAID tags. If we generate VPAID tags, there's a significant risk they'll be rejected, which would delay the campaign launch.\"\n\n3. **Offer alternatives:**\n   - **VAST + interactive companion banner** — The video plays as standard VAST, with a rich media companion banner that provides the interactive elements\n   - **SIMID** — If the publisher supports it, this gives you the interactivity of VPAID in a secure, sandboxed environment\n   - **Standard VAST with interactive end cards** — Many video players support interactive end screens within VAST 4.1\n\n4. **Suggest a publisher check:** \"Let's verify with each publisher on the buy whether they still accept VPAID. For those that don't, we'll use one of the alternatives.\"\n\nWould you like me to check which sites in the account are likely to support VPAID vs. requiring VAST?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VPAID', description: 'Addresses VPAID directly' },
      { type: 'contains', value: 'declining', description: 'Notes declining support' },
    ],
  },
  {
    id: 'VT-027',
    prompt: "I need VAST 4.2 tags but the publisher only supports 3.0 — what do I do?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains version compatibility and recommends matching the publisher version',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "First, a quick clarification: VAST 4.2 doesn't exist yet — the latest version is VAST 4.1. But I understand the situation: you want the newest VAST features but the publisher is capped at 3.0. Let me help you navigate this.\n\n**The publisher's version is what matters.** Here's why:\n- The publisher's video player is built to parse a specific VAST version\n- If you send a VAST 4.x tag to a player that only supports 3.0, the player may fail to parse it, ignore unknown elements, or throw an error\n- Unlike web browsers, video players don't always gracefully handle unknown XML elements\n\n**What to do:**\nGenerate your tags as **VAST 3.0** to match the publisher's requirement. This ensures compatibility.\n\n**What you'll lose vs. 4.0/4.1:**\n- No verification/viewability resources in the VAST XML\n- No mezzanine file support\n- No server-side ad insertion (SSAI) features\n- No interactive creative file references\n\n**What you keep with VAST 3.0:**\n- All core video ad functionality (linear ads, tracking events, click-throughs)\n- Ad pod support (sequential ads)\n- Skippable ad controls\n- Companion ad support\n- Error reporting\n\nFor most standard pre-roll campaigns, VAST 3.0 has everything you need. The publisher spec is the source of truth — always downgrade to match their version rather than hoping they'll accept a newer one.\n\nWant me to set up the placement with VAST 3.0?",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Discusses VAST version compatibility' },
      { type: 'contains', value: '3.0', description: 'Recommends matching VAST 3.0' },
      { type: 'contains', value: 'publisher', description: 'References publisher requirements as authoritative' },
    ],
  },
  {
    id: 'VT-028',
    prompt: 'What happens if I send VAST tags to a placement that expects JavaScript?',
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Explains the tag type mismatch will cause failure',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "Sending the wrong tag type is a common trafficking mistake, and it will cause the ad to fail. Here's what happens:\n\n**VAST tag → JavaScript/display placement:**\n- The publisher's ad server or page expects a `<script>` tag that renders a banner ad\n- Instead it receives VAST XML (which is a video ad protocol)\n- The page has no video player to interpret the VAST XML\n- **Result:** The ad won't render at all. The ad slot will be blank, show a default/house ad, or collapse. No impression is recorded.\n\n**JavaScript tag → VAST/video placement:**\n- The publisher's video player expects VAST XML (a structured document describing the video creative)\n- Instead it receives a JavaScript snippet meant to render a display banner\n- The video player can't parse JavaScript as VAST XML\n- **Result:** The video player throws a VAST error, shows nothing, and typically moves to the next ad in the pod or starts the content video. No impression is recorded.\n\n**In both cases:**\n- No error message is shown to the user (the failure is silent)\n- No impressions are delivered\n- The publisher will likely contact you saying \"your tags aren't working\"\n- You'll need to regenerate tags in the correct format and resend them\n\n**How to avoid this:**\n1. Always check the publisher spec for the required tag type\n2. Match the tag format to the placement type (display = JavaScript, video = VAST)\n3. QA tags before sending — verify the tag format matches expectations\n\nThis is one of the reasons I always confirm the tag type before generating. It's a quick question that prevents a painful round-trip with the publisher.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Discusses VAST in mismatch scenario' },
      { type: 'contains', value: 'JavaScript', description: 'Discusses JavaScript in mismatch scenario' },
      { type: 'contains', value: 'fail', description: 'Explains failure outcome' },
    ],
  },
  {
    id: 'VT-029',
    prompt: 'Generate tags for all Meridian Financial video placements in VAST 4.1 format',
    category: 'video-trafficking',
    expectedTools: ['cm360_list_profiles', 'cm360_list_advertisers', 'cm360_list_campaigns', 'cm360_list_placements'],
    expectedBehavior: 'Looks up Meridian Financial placements and discusses VAST 4.1 tags',
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
          { type: 'tool_use', id: 'tu_4', name: 'cm360_list_placements', input: { profileId: '12345', advertiserId: '90002' } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [
          {
            type: 'text',
            text: "I've pulled up all placements for **Meridian Financial**. Looking through them, the current placements are all display-type (standard banner placements).\n\nTo generate VAST 4.1 video tags, we'd need video (IN_STREAM_VIDEO) placements. Here are your options:\n\n1. **Create new video placements** for Meridian Financial — I can set them up with VAST 4.1 tag format. Just tell me which sites and sizes.\n\n2. **Check if any existing placements should have been video** — If there are placements that were intended for video but set up as display, we can create new video versions.\n\nFor reference, Meridian Financial has campaigns across multiple quarters. Which campaign should the video placements go into?\n\nAlso, for VAST 4.1 video placements, I'll need:\n- **Sites** — Which publishers?\n- **Video size** — 640x360 (standard) or 1920x1080 (HD)?\n- **Duration** — 15s, 30s, or both?\n\nLet me know how you'd like to proceed!",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST 4.1', description: 'References the requested VAST version' },
      { type: 'contains', value: 'Meridian', description: 'References Meridian Financial' },
    ],
  },
  {
    id: 'VT-030',
    prompt: "I'm trafficking a CTV campaign — what tag type should I use?",
    category: 'video-trafficking',
    expectedTools: [],
    expectedBehavior: 'Recommends VAST for CTV and explains CTV-specific considerations',
    mockToolSequence: [
      {
        content: [
          {
            type: 'text',
            text: "For a CTV (Connected TV) campaign, you should use **VAST** tags — specifically **VAST 4.0 or 4.1**.\n\nHere's why VAST is the standard for CTV:\n\n- CTV devices (Roku, Apple TV, Fire TV, smart TVs) use video players that are built to consume VAST XML\n- There's no browser environment on most CTV devices, so JavaScript tags won't work\n- VPAID is not supported on CTV (no JavaScript runtime in most CTV apps)\n- VAST 4.0+ is recommended because it includes server-side ad insertion (SSAI) support, which is the primary ad delivery method for CTV\n\n**CTV-specific considerations:**\n\n| Factor | CTV Requirement |\n|---|---|\n| Tag format | VAST 4.0 or 4.1 |\n| Delivery method | Server-Side Ad Insertion (SSAI) preferred |\n| Video quality | HD required (1920x1080 or 1280x720 minimum) |\n| Interactivity | Limited — no VPAID, minimal SIMID support |\n| Tracking | Server-side tracking for SSAI; standard VAST tracking for client-side |\n| Companion ads | Not supported on most CTV platforms |\n| Skippability | Usually non-skippable (platform-dependent) |\n\n**SSAI vs. client-side:**\nMany CTV publishers use SSAI, where the ad is stitched into the content stream server-side. This requires VAST 4.0+ with proper SSAI tracking macros. Check with the publisher whether they use SSAI or client-side ad insertion.\n\nWhich CTV platform/publisher are you working with? I can help set up the placements.",
          },
        ],
        stop_reason: 'end_turn',
      },
    ],
    responseAssertions: [
      { type: 'contains', value: 'VAST', description: 'Recommends VAST for CTV' },
      { type: 'contains', value: 'CTV', description: 'Addresses CTV specifically' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Export all video-trafficking prompts
// ---------------------------------------------------------------------------

export const VIDEO_TRAFFICKING_PROMPTS: TestPrompt[] = [
  ...tagTypeKnowledge,
  ...tagTypeRecommendations,
  ...vendorSpecHandling,
  ...videoPlacementSetup,
  ...tagTypeConfirmation,
];
