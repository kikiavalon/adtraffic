# CM360 Domain Knowledge Reference
**Source:** Google CM360 Help Center (support.google.com/campaignmanager)
**Extracted:** 2026-02-26
**Purpose:** General domain knowledge to enhance Kiki's understanding of CM360 concepts, workflows, and best practices.

## Table of Contents
1. [Campaigns, Ads, and Creatives](#1-campaigns-ads-and-creatives) — Campaign spreadsheets, trafficking workflow, notifications, advertisers, landing pages, ad types, creative-placement assignments, creative types
2. [Placements, Sites, Tags, and Event Tags](#2-placements-sites-tags-and-event-tags) — Placement properties, schedule/pricing (CPM/vCPM/CPC/CPA), tag types (standard/iframe/ins), tag workflow, IAB TCF, event tags
3. [Floodlight and Audience](#3-floodlight-and-audience) — Conversion tracking, counting methods, tag types (Google tag/iframe-image/GTM), custom variables, audience/remarketing lists, privacy
4. [Reporting and Verification](#4-reporting-and-verification) — Impression/click counting (IAB), instant reporting, report types, dimensions, metrics, Data Transfer, Brand Controls
5. [Mobile and Video](#5-mobile-and-video) — Mobile trafficking (ins tags, device ID), VAST 2.0/3.0/4.0, video redirects, VPAID, compatibility, platform-specific trafficking
6. [Status Management, Macros, and Other Trafficking Concepts](#6-status-management-macros-and-other-trafficking-concepts) — Status values, ad serving checklist, CM360 macros table, SSL compliance, compatibility/assignments, creative rotation, diagnostics

## Quick Reference — Key Concepts for Kiki

| Concept | What Kiki Should Know |
|---------|----------------------|
| **Entity hierarchy** | Account → Advertiser → Campaign → Placement/Ad → Creative |
| **Placement = ad slot** | A placement represents a specific location on a publisher's site where ads appear |
| **Tags = embed code** | HTML/JS code that publishers put on their sites to serve CM360 ads |
| **Creatives are advertiser-level** | Changes to a creative affect ALL campaigns using it |
| **Ads cannot be deleted** | Only archived — this is a CM360 limitation |
| **Status chain** | Campaign + Placement + Ad must ALL be Active for ads to serve |
| **Floodlight = conversion tracking** | Shared across CM360, DV360, and SA360 |
| **Compatibility gate** | Display creatives can't go in video placements (and vice versa) |
| **Creative rotation** | Even, Weighted, Sequential, or Optimized (auto-CTR) |
| **Cost structures** | CPM (most common), vCPM, CPC, CPA, Flat rate |
| **SSL required** | All assets must be HTTPS — no exceptions |
| **IAB counting** | CM360 follows IAB standards with third-party audit |
| **EU political ads (v5)** | Campaigns carry an optional `euPoliticalAdsDeclaration`; CM360 blocks campaigns declared as containing EU political ads from serving in the EU |

---

## Help Center Structure

| Category | Sub-topics |
|----------|-----------|
| Get started | Overview, API overview, Start trafficking, Announcements |
| **Trafficking** | Trafficking workflow, Campaigns/ads/creatives, Placements/sites/tags/event tags, Edit assignments, Manage status, CM360 macros, SSL compliance, Diagnostics |
| **Mobile and video** | Mobile guidelines, Mobile reporting, In-stream video, VPAID, Twitter/LinkedIn/Snapchat/Meta/Netflix/Spotify ads |
| **Floodlight and audience** | Floodlight conversion tracking, Audience (remarketing) |
| **Reporting and verification** | Reporting, Brand Controls, Data Manager |
| Planning | Introduction, Build a project, Planning for publishers |
| Account admin | Manage accounts, advertisers, user access, privacy/policies, invoices/billing |
| Fix a problem | Admin/access, Ads/creatives, Floodlight/audience, Tag implementation, Browser issues |

---

## 1. CAMPAIGNS, ADS, AND CREATIVES

### 1.1 Campaign Spreadsheet (Bulk Operations)

You can use a spreadsheet to create and manage campaigns in bulk. Export types:
- Summary, Placements, Ads, Creatives, Placements and Ads, Ads and Creatives

Key capabilities:
- **Editing**: placements, ads, and tracking creatives
- **Creation**: placements, ads, and tracking creatives
- **Assignment/Unassignment**: placements, ads, and creatives
- Custom templates can be saved for reuse
- Default templates have predefined columns that can be customized
- Filter options: active, inactive, all
- Each row represents a placement, ad-creative, or combination
- When an ad is assigned to multiple placements, each assignment gets its own row

### 1.2 Trafficking Workflow

Traffic campaigns in the Trafficking component of CM360. Key areas:

**Navigation levels:**
- **Advertiser level**: Click "All advertisers" from account level. Set up shared creative library on Creatives tab
- **Campaign level**: Click "All campaigns" from account level. View all items in campaign
- **Admin level**: Click "Admin" to manage account settings like user access

**Edit items:**
- Select items via checkboxes
- Use Status, Assignments, Edit multiple buttons
- In-line editing (click directly into row for name or date changes)

**Create items:**
- New > [Ad type / Placement / Creative]
- Copy campaigns from existing ones

**Find items:**
- Search bar with filters
- Views menu for saved views
- Scroll through up to 100 results per page
- Toggle All vs Selected rows

**Manage placement tags:**
- Click Tags button in campaign header (upper right)
- Options: download tags, email tags, notify publishers about publisher-paid tags

**Bulk tasks:**
- Import/export spreadsheets for bulk changes
- Campaign spreadsheet: full campaign data, can reimport changes
- CSV export: current view only, informational (cannot reimport)

**View performance:**
- Click any placement/ad/creative > Performance tab
- Shows impressions and clicks
- Campaign view shows last 30 days per item

### 1.3 Notifications

CM360 provides several notification types:
- **Trafficking notifications**: Alerts about starred campaigns (missing click tags, placements without default ads, Floodlight config issues)
- **In-product messages**: Upcoming changes, UI issues
- **Billing notifications**: Email alerts when users request billing access

Star campaigns to trigger notifications and pin them to top of list.

### 1.4 Advertisers

Each advertiser contains a group of campaigns, creative assets, and settings. Structure decisions:
- One advertiser per client
- Separate advertisers for different product lines/divisions

After creating: set up Floodlight, create campaigns, manage creatives at advertiser level.

### 1.5 Landing Pages

A landing page is the final destination when users click/tap an ad. Supports up to 3 destinations per landing page:
- **URL**: Standard website link
- **Custom Android deep link**: Non-HTTP deep link for Android apps (in-app ads)
- **Custom iOS deep link**: Non-HTTP deep link for iOS apps (audience list required)

CM360 automatically serves the correct link based on device, environment, and app installation.

Management:
- Advertiser-level Landing pages tab for centralized management
- Bulk upload URL landing pages
- Reuse across all campaigns, ads, and creatives within an advertiser
- Landing pages can also be set at campaign, ad, or creative level

### 1.6 Ad Types

Four ad types in CM360:
1. **Standard ads**: Deliver creatives to placements. Can be interstitial or in-page. Works with all creative types (display, in-stream, rich media, redirect)
2. **Default ads**: Serve when no other ads are available for a placement
3. **Tracking ads**: Track clicks and impressions on ads NOT delivered by CM360
4. **Click tracker ads**: Track clicks on hard-coded elements not delivered by CM360

**Creating ads:**
- Open campaign > New > [ad type]
- Can also copy ads, create via spreadsheet import, or auto-create from creative-placement assignments
- **You cannot delete ads** - only archive inactive ads

**Requirements for standard ads to serve:**
- Ad must be active
- Creative must be assigned and active
- Placement must be assigned and active
- Ad dates must be within the campaign's date range

**Ad properties include:**
- Identification
- Delivery properties
- Creative assignments
- Placement assignments
- Landing page URL suffix
- Dynamic targeting keys
- Event tags
- Targeting sections
- Audience segmentation

### 1.7 Creative-Placement Assignments

When assigning creatives to placements, CM360 automatically creates ads. Options:
- Create one ad for all creatives
- Create one ad per creative
- Create one ad per placement
- Create one ad per creative per placement

Creatives must meet size and duration-orientation requirements for display placements.

### 1.8 Creative Types

Different creative types have different properties. Types:
- **Display creatives** (image + HTML5)
- **General rich media creatives**
- **VPAID rich media creatives**
- **In-stream audio creatives**
- **In-stream video creatives**
- **Custom display creatives**
- **Custom display interstitial creatives**
- **Display redirect creatives**
- **In-stream video redirect creatives**

Key behavior: Creatives are shared at the advertiser level. Changes affect ALL campaigns using that creative (name changes, activation/deactivation apply everywhere).

---

## 2. PLACEMENTS, SITES, TAGS, AND EVENT TAGS

### 2.1 Placement Properties

Placements are the core trafficking entity — they represent a specific ad slot on a publisher site. Key properties:
- **Name**: Descriptive identifier for the placement
- **Site**: The publisher site where the ad will appear
- **Size**: Ad dimensions (e.g., 300x250, 728x90)
- **Compatibility**: Display, display interstitial, in-stream video, in-stream audio
- **Payment source**: Agency-paid (default) or publisher-paid
- **Tags**: Generated after placement creation for site implementation
- **Status**: Active, inactive, or archived

### 2.2 Placement Schedule & Pricing

Placements have independent scheduling and pricing:
- **Start/end dates**: Must fall within campaign date range
- **Pricing schedule**: Can define multiple pricing periods within placement dates
- **Cost structures** (critical for billing):
  - **CPM** (Cost Per Mille): Cost per 1,000 impressions — most common
  - **vCPM** (Viewable CPM): Cost per 1,000 viewable impressions
  - **CPC** (Cost Per Click): Cost per click
  - **CPA** (Cost Per Action): Cost per conversion/action
  - **Flat rate**: Fixed cost regardless of delivery
- **Units**: Number of impressions/clicks/actions contracted
- **Cap cost type**: Controls budget pacing

### 2.3 Creating and Managing Placements

Creation methods:
- **Individual**: New > Placement in campaign view
- **Campaign spreadsheet**: Bulk create via spreadsheet import
- **Copy**: Duplicate existing placement (with or without ads)

After creation:
- Generate and download tags for publisher implementation
- Assign ads and creatives to the placement
- Set pricing schedule and contracted units
- Cannot delete placements — only archive

### 2.4 Placement Tags

Tags are the HTML/JavaScript code publishers embed on their sites to serve ads:

**Tag types:**
- **Standard tags**: JavaScript (`<script>`) — most common, supports rich media
- **iframe tags**: For environments that don't support JavaScript
- **Internal redirect tags**: Server-to-server redirects (for other ad servers)
- **Ins tags**: CM360's lightweight tag format (Google Publisher Tags compatible)

**Tag workflow:**
1. Create placements in campaign
2. Click "Tags" button in campaign header
3. Select placements to generate tags for
4. Choose tag format (standard, iframe, ins, internal redirect)
5. Download tags as file OR email directly to publisher
6. Publisher implements tags on their site
7. Ads begin serving when all conditions are met (active ad, creative, placement, within date range)

**Payment source affects tags:**
- **Agency-paid** (default): Agency's ad server controls delivery. Tags point to CM360.
- **Publisher-paid**: Publisher controls delivery. Different tag format. Publisher can be notified directly from CM360 UI.

### 2.5 Tag Sending and Management

**Download options:**
- Download all tags for campaign
- Download tags for selected placements only
- Download as text file or Excel

**Email to publishers:**
- Send tags directly from CM360 to publisher contacts
- Includes placement details, tag code, and implementation instructions
- Track whether publisher has received tags

**The Trade Desk integration:**
- CM360 supports direct tag export to The Trade Desk format
- Streamlines programmatic placement setup

### 2.6 IAB TCF v2.0 Integration

CM360 supports IAB Transparency and Consent Framework:
- Tags can pass consent signals from publisher CMP (Consent Management Platform)
- `gdpr` and `gdpr_consent` macros available in tag URLs
- Enables GDPR-compliant ad serving in EU markets
- Consent string passed through the tag to CM360 for decision-making

### 2.7 Sites and Brand Controls

Sites represent publisher properties where ads can appear:
- Sites must be added to CM360 before placements can reference them
- Can browse Google's Directory Sites for verified publishers
- **Brand Controls**: Content-level blocking criteria
  - Block by content category
  - Block by keyword
  - Block by specific URL patterns
  - Applied at campaign or placement level

### 2.8 Event Tags

Event tags are tracking pixels that fire alongside ad impressions or clicks:

**Types:**
- **Impression event tags**: Fire when an ad impression is served (1x1 pixel or JavaScript)
- **Click event tags**: Fire when a user clicks an ad (redirect URL)

**Use cases:**
- Third-party verification (DoubleVerify, IAS, Moat)
- Audience measurement (Nielsen, comScore)
- Attribution tracking
- Survey/research pixels (Dynamic Logic, Vizu)

**Setup:**
- Create at campaign level or placement level
- Campaign-level event tags apply to all placements in the campaign
- Can enable/disable per-placement
- Specify URL of the tracking pixel/redirect
- Choose type: impression or click

**Limitations:**
- Event tags fire client-side (browser), not server-side
- Subject to ad blocker interference
- Cannot be used for conversion tracking (use Floodlight instead)
- One event tag can be attached to multiple campaigns/placements

---

## 3. FLOODLIGHT AND AUDIENCE

### 3.1 What Is Floodlight

Floodlight is the conversion tracking system for the Google Marketing Platform (GMP). It acts as a shared data layer across CM360, Display & Video 360 (DV360), and Search Ads 360 (SA360).

**Core purpose:** Track user actions (conversions) after they see or click ads, using a single set of tags across all GMP platforms.

**Key benefits:**
- **Cross-channel measurement**: De-duplicates conversions across display and search campaigns
- **Audience building**: Create remarketing lists based on user actions (e.g., "Added to Cart")
- **Bidding optimization**: Floodlight data powers automated bidding in SA360 and DV360

### 3.2 How Floodlight Works

1. **Tags on site**: A Floodlight tag (snippet of code) is placed on advertiser's website pages (e.g., "Thank You" page after purchase)
2. **Impression generated**: When a user visits a tagged page, a Floodlight impression fires
3. **Conversion matching**: CM360 checks if the user previously saw or clicked an ad within the conversion window
4. **Conversion recorded**: If a match is found, the action is recorded as a conversion

**Conversion windows:**
- Configurable per-placement
- 0 days = within 24 hours, 1 day = within 48 hours, etc.
- Uses the most recent click first; if no click, uses most recent impression
- Different placements can have different conversion windows

### 3.3 Counting Methods

Floodlight activities have different counting methods:
- **Standard counting**: Counts one conversion per user per session (for actions like sign-ups)
- **Unique counting**: Counts one conversion per user per day
- **Per session counting**: Counts each qualifying event (for purchases where multiple items may be bought)
- **Sales activities**: Can count number of items or revenue per event

### 3.4 Floodlight Configuration and Activities

**Floodlight configuration:** Account-level settings shared across all activities for an advertiser
- Set at advertiser level in CM360
- Defines default conversion windows, tag types, third-party integrations
- Shared between CM360 and SA360 (synced automatically)

**Floodlight activities:** Individual conversion events to track
- Created within a Floodlight configuration
- Each activity has its own tag to place on a specific page
- **Activity statuses**: Active (collecting data) or Disabled & archived (stops counting, hidden by default)
- Activities can be organized into **activity groups** for reporting

### 3.5 Floodlight Tag Types

**Google tag (gtag.js):** Modern recommended approach
- Single global snippet + per-activity event snippet
- Shared across all Google accounts (GA4, Google Ads, CM360)
- Supports enhanced conversions

**iframe/image tags:** Legacy format
- iframe: More capable, supports JavaScript
- Image: Simplest, fires a 1x1 pixel request

**Google Tag Manager (GTM):** Container-based deployment
- Manage Floodlight tags alongside other marketing tags
- No code changes needed after initial GTM setup

### 3.6 Custom Floodlight Variables

Custom variables pass additional data with Floodlight tags:
- **u-variables** (u1, u2, u3...): Custom string values
- **Revenue**: Transaction value
- **Order ID**: Unique transaction identifier (for deduplication)
- Used for audience list rules, reporting dimensions, and custom conversions

### 3.7 Floodlight and SA360 Sharing

- Every SA360 sub-manager account maps to a CM360 advertiser
- Floodlight activities created in SA360 appear in CM360 (and vice versa)
- Custom Floodlight variables are synced across platforms
- This prevents double-counting conversions across search and display

### 3.8 Audience Lists (Remarketing)

**What they are:** Lists of users who performed specific actions, built from Floodlight data.

**Workflow:**
1. Create a Floodlight configuration
2. Create Floodlight activities and implement tags
3. Create audience list based on activity or custom rules
4. (Optional) Share list with other advertisers/accounts
5. Build targeting expressions to serve ads to list members

**List creation options:**
- Based directly on a Floodlight activity (all users who completed it)
- Custom rules using Floodlight variables (e.g., users who bought > $100)

**Targeting expressions:**
- Combine multiple lists with AND/OR logic
- Exclude lists (e.g., target cart abandoners by including "cart" list, excluding "purchase" list)
- No limit on expression size or number of activities
- Shared lists from other advertisers can be included

### 3.9 Audience Privacy Requirements

**Mandatory for audience list usage:**
- Privacy policy must describe use of audience lists in online advertising
- Must disclose third-party vendors (including Google) use cookies for ad targeting
- Must provide opt-out options:
  - Google Ads Settings page
  - NAI (Network Advertising Initiative) opt-out page
- Must comply with GDPR, CCPA, and other applicable privacy regulations

---

## 4. REPORTING AND VERIFICATION

### 4.1 Reporting Overview

CM360 Reporting organizes campaign performance data into actionable views:
- **Summary tab**: Overview of campaign performance with drill-down capability
- **Instant reporting**: Near-real-time data access for quick performance checks and ad-hoc reports
- **Report Builder**: Full-featured report creation with dimensions, metrics, filters, scheduling
- **Attribution tab**: Data-driven attribution models
- **Verification**: Tag validation, geo-targeting stats, domain/URL reporting

### 4.2 How CM360 Counts Impressions and Clicks

CM360 follows IAB counting standards with third-party audits:

**Impression counting:**
1. User accesses content with CM360 ad tags (mobile app or webpage)
2. Browser/app sends ad request to CM360
3. CM360 selects and delivers creative content
4. Creative code calls back to CM360 once impression standard is met
5. Display ads: counted when creative begins rendering (not when fully loaded)
6. Video ads: counted at start of video playback

**Click counting:**
- Counted when user initiates a click action
- Click redirect URL records the click before landing page loads

**Invalid traffic filtering:**
- Google removes invalid clicks/impressions from automated services and suspicious human traffic
- Pre-bid filtration (never bought) and post-serve filtration (credited back)
- Integration with HUMAN (formerly White Ops) as additional verification layer
- Invalid traffic metrics available in reporting

### 4.3 Instant Reporting

Instant reporting provides near-real-time data without waiting for report downloads:
- Create reports directly in the CM360 UI
- Add dimensions and metrics interactively
- Visualizations: bar charts, pie charts
- Auto-run toggle: reports refresh with every change or only on manual run
- Can save and download for offline use
- Some reports require download only (pivoted, custom variables, unattributed conversions)

### 4.4 Report Types

**Standard reports:** Most common — campaign/ad/placement performance metrics (impressions, clicks, conversions, cost)

**Reach reports:**
- **Unique Reach**: Measures users across devices and environments
- **GRP reports**: Gross Rating Point measurement
- **Co-viewing**: CTV co-viewing measurement (multiple viewers per impression)
- **Unique Reach Overlap**: Cross-campaign reach overlap
- **Cross-media reach**: Linear TV + digital combined reach

**Floodlight reports:** Conversion data, attribution analysis

**Path to Conversion reports:** Full user journey from impression/click to conversion

**Attribution modeling:** Data-driven attribution across touchpoints

### 4.5 Key Reporting Dimensions

Dimensions segment data by different attributes:
- **Campaign hierarchy**: Campaign, ad, creative, placement, site
- **Geographic**: Country, region, city, metro, postal code
- **Technology**: Browser, OS, platform type, connection type, mobile carrier
- **Environment**: App vs. web, app ID, app name
- **Temporal**: Date, week, month, hour of day
- **Content**: Content category, domain, URL

### 4.6 Key Reporting Metrics

Core metrics categories:
- **Delivery**: Impressions, clicks, CTR (click-through rate)
- **Active View**: Viewable impressions, viewable rate, average viewable time
- **Video**: Video starts, completes, completion rate, quartile views
- **Conversions**: Total conversions, conversion rate, revenue
- **Cost**: Media cost, eCPM, eCPC, eCPA
- **Invalid traffic**: Invalid impressions, invalid clicks (filtered)
- **Reach**: Unique reach, frequency, GRP

### 4.7 Data Transfer v2

For large-scale data needs, CM360 supports Data Transfer:
- Raw log-level data exported to Google Cloud Storage
- Includes impression, click, and conversion-level data
- Used for custom attribution, advanced analytics, data warehouse integration
- Available as DCM (CM360) and Unified (CM360 + DV360) formats

### 4.8 Brand Controls and Verification

Brand Controls protect advertisers from unwanted ad placements:
- **Verification**: Checks tag formatting and provides domain/URL reporting
- **Content classification**: Pages categorized by content type
- **Ad blocking**: Block ads from serving on specific content categories, domains, or URLs
- **Geo-targeting verification**: Confirms ads serve in correct regions

---

## 5. MOBILE AND VIDEO

### 5.1 Mobile Trafficking Guidelines

The basic trafficking process is the same for mobile — no special mobile placement, ad, or tag type. Three key considerations:

**Placement tags for mobile apps:**
- All tags include `dc_rdid=` parameter (resettable device ID) — publisher must populate
- Optional parameters: `tag_for_child_directed_treatment=` and `dc_lat=` (limit ad tracking)
- `dc_msid=` parameter for App and App ID reporting (e.g., `com.android.chrome`)
- **ins tag** is preferred format for mobile environments

**Ad and creative setup:**
- Consider mobile targeting options to limit which devices receive ads
- Creative sizes and formats must match mobile placement dimensions
- Interstitial creatives for full-screen mobile app ads

**Mobile reporting dimensions:**
- App, App ID, Browser/Platform, Connection type, Mobile carrier
- Operating system, OS version, Platform type, Environment
- Available in Standard, Floodlight, Path to Conversion, and Reach reports

### 5.2 In-Stream Video Creatives

Video trafficking requires publisher VAST compliance:

**Media planning steps:**
1. Confirm publisher site supports VAST 2.0, 3.0, or 4.0 standard
2. Collect site specs: video format, bitrate, companion banner support, tracking type
3. Developer prepares creative to site specifications

**Key video specifications:**
- Video assets: MP4/WebM, various bitrates and resolutions
- Companion banners: Display ads alongside video (optional)
- Tracking: Impression, click, video events (start, first/mid/third quartile, complete)

**Video creative setup in CM360:**
1. Add video assets and set up serving files
2. Configure dynamic asset selection (multiple video qualities)
3. Add companion creatives (optional display banners)
4. Add third-party tracking URLs

### 5.3 In-Stream Video Redirects

Video redirect creatives track video ads served by non-CM360 ad servers:
- No video assets — redirects to a VAST URL you specify
- Used for tracking ads hosted on other platforms
- Supports companion creatives alongside the redirect
- Not supported in Display & Video 360
- Batch upload available for multiple redirects (auto-generates placements)

### 5.4 VPAID Creatives

VPAID (Video Player-Ad Interface Definition) enables rich media within video players:
- Delivered as additional asset within a VAST tag
- Used for interactive video ads (polls, expandable content, overlays)
- Can pause/mute the publisher's video player
- Publisher must be VPAID-compliant to render correctly
- CM360 only supports **linear** VPAID (standalone, not alongside content)
- Built in **Studio** (Google's rich media creative tool) — cannot upload directly to CM360
- Requires advertiser association between CM360 and Studio

### 5.5 Compatibility System

Compatibility determines which creative types work with which placement types:
- **Display**: Appears on web page
- **Display interstitial**: Full-screen in mobile app or on webpage
- **In-stream audio**: Appears in audio player
- **In-stream video**: Appears in video player

**Rule:** Creative, ad, and placement must share at least one compatibility for assignments to work. CM360 validates this automatically.

### 5.6 Platform-Specific Trafficking

CM360 supports trafficking for social/walled garden platforms:
- **Twitter/X Ads**: Tag format and integration specifics
- **LinkedIn Ads**: B2B campaign tracking
- **Snapchat Ads**: Mobile-first creative specifications
- **Meta Ads**: Facebook/Instagram tracking integration
- **Netflix Ads**: CTV ad tracking
- **Spotify Ads**: Audio ad tracking

---

## 6. STATUS MANAGEMENT, MACROS, AND OTHER TRAFFICKING CONCEPTS

### 6.1 Manage Status

CM360 items have different status values that control whether they serve:

**Campaign Status Values:**
- **Active** — Campaign is live and can serve ads
- **Archived** — Campaign is removed from active lists, cannot serve
- **Planning** — Campaign is in planning phase (not yet trafficking)

**Placement / Ad / Creative Status:**
- **Active** — Serving or ready to serve
- **Inactive** — Paused, not serving
- **Archived** — Removed from active management

**Key Status Rules:**
- A campaign must be **Active** for any of its placements/ads to serve
- A placement must be **Active** for its ads to serve
- An ad must be **Active** and within its date range to serve
- Archiving a campaign does NOT archive its child placements/ads — they remain in their current status but cannot serve because the parent is archived
- Status changes take effect immediately (no propagation delay)

**Status Checklist for Ad Serving:**
For an ad to actually serve, ALL of these must be true:
1. Campaign status = Active
2. Campaign dates include current date
3. Placement status = Active (activeStatus = ACTIVE)
4. Placement dates include current date
5. Ad status = Active
6. Ad dates include current date (if set)
7. Creative is assigned and active
8. Tags have been generated and placed on the publisher's site

### 6.2 CM360 Macros

CM360 supports macros in ad tags and click-through URLs that are dynamically replaced at serve time:

| Macro | Name | Description |
|-------|------|-------------|
| `%c` | Click string | Cache-busting click tracker for click-through URLs |
| `%e` | Expand command | Used in expandable/rich media creatives |
| `%g` | Geographic | Inserts geographic information (country code) |
| `%h` | Creative server host | The ad server hostname |
| `%i` | Impression string | Unique impression identifier |
| `%k` | Keyword | Passes keyword targeting data |
| `%m` | Match/campaign | Campaign-level match data |
| `%n` | Random/cache-buster | Random number for cache busting (prevents browser caching) |
| `%p` | Pattern match | Passes site-specific pattern data for targeting |
| `%r` | Referring URL | The page URL where the ad is displayed |
| `%s` | Site | Site identifier |
| `%u` | Unescaped click | Unescaped version of the click-through URL |
| `%%CLICK_URL_UNESC%%` | Click URL (unescaped) | Full unescaped click-through URL for third-party tracking |
| `%%CLICK_URL_ESC%%` | Click URL (escaped) | URL-encoded click-through URL |
| `%%CACHEBUSTER%%` | Cache buster | Standard cache-busting macro |
| `%%SITE%%` | Site name | The site where the ad serves |

**Macro Usage Best Practices:**
- Always include `%n` or `%%CACHEBUSTER%%` in tags to prevent caching
- Use `%c` in click-through URLs to enable click tracking
- Third-party click trackers should use `%%CLICK_URL_UNESC%%` or `%%CLICK_URL_ESC%%`
- Macros are case-sensitive — `%N` is NOT the same as `%n`
- Custom macros can be defined for specific trafficking needs

### 6.3 SSL Compliance

**All CM360 ad tags serve over HTTPS by default.** This has been the standard since 2015.

**Key SSL Requirements:**
- All creative assets (images, scripts, videos) must be hosted on HTTPS URLs
- Third-party tracking pixels must use HTTPS
- Landing page URLs should use HTTPS (not strictly required for serving, but recommended)
- Mixed content (HTTP assets in HTTPS pages) will be blocked by modern browsers
- CM360 will flag non-SSL-compliant creatives during the trafficking process

**How CM360 Handles Non-Compliant Items:**
- Creatives with HTTP-only assets will show a warning in the UI
- Tags generated will always use HTTPS regardless of creative asset URLs
- Non-compliant third-party trackers may fail silently in the browser
- CM360 does NOT automatically convert HTTP URLs to HTTPS — the trafficker must update them

**SSL Compliance Checklist:**
1. All image URLs start with `https://`
2. All JavaScript/CSS URLs start with `https://`
3. All video asset URLs start with `https://`
4. All third-party tracking pixels use `https://`
5. Click-through URLs use `https://` (recommended)
6. All custom creative code references HTTPS resources only

### 6.4 Compatibility and Assignments

**Compatibility** in CM360 determines which creative types can be assigned to which placement types:

| Placement Compatibility | Supported Creative Types |
|------------------------|-------------------------|
| **Display** | Image, HTML5, Third-party (standard display ads) |
| **Display Interstitial** | Image, HTML5, Third-party (full-page takeover ads) |
| **In-stream Video** | VAST video, VPAID, Video redirect (pre/mid/post-roll) |
| **In-stream Audio** | Audio creatives (podcast/streaming audio ads) |

**Assignment Rules:**
- A creative can only be assigned to a placement with a **compatible** type
- Display creatives CANNOT be assigned to in-stream video placements (and vice versa)
- Size compatibility: creative dimensions must match placement dimensions for display ads
- Video placements don't have size restrictions in the same way (player handles sizing)
- Multiple creatives can be assigned to a single placement (creative rotation)
- A single creative can be assigned to multiple placements across campaigns

**Creative Rotation:**
- **Even** — All assigned creatives serve equally
- **Weighted** — Creatives serve based on assigned weight percentages
- **Sequential** — Creatives serve in a specific order
- **Optimized** — CM360 automatically optimizes based on performance (click-through rate)

### 6.5 Diagnostics and Troubleshooting

**Common Trafficking Issues:**
- **Ads not serving:** Check the status checklist (Section 6.1) — most common cause is a status not set to Active or dates not current
- **Wrong creative showing:** Verify creative-to-placement assignments and rotation settings
- **Click tracking not working:** Ensure `%c` macro is in the click-through URL and the landing page URL is correct
- **Impression discrepancies:** Normal variance is 5-15% between CM360 and publisher counts due to counting methodology differences (IAB standards)
- **Tags not firing:** Verify tags are correctly placed on the publisher page, check for JavaScript errors in browser console
- **SSL errors:** Check all asset URLs for HTTP references (see Section 6.3)

---
