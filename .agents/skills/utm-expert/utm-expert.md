---
name: utm-expert
description: Use when users ask about UTM parameters, URL tagging, campaign tracking URLs, or landing page URL construction. Provides expert knowledge on UTM conventions, Google Analytics integration, and CM360 macro injection.
---

# UTM Expert Skill

## When to Use
- User asks to create/update landing page URLs with UTM parameters
- User asks about UTM naming conventions
- User needs to build tracking URLs for CM360 placements
- User mentions Google Analytics attribution or campaign tracking
- User asks about CM360 macros in URLs (click macros, cache busters)

## UTM Parameter Reference

### Required Parameters (always include)
| Parameter | Purpose | Convention | Example |
|-----------|---------|------------|---------|
| `utm_source` | Traffic source | Lowercase, no spaces, use the ad platform name | `cm360`, `google`, `facebook` |
| `utm_medium` | Marketing medium | Lowercase, standard values only | `display`, `video`, `native`, `email`, `cpc`, `social` |
| `utm_campaign` | Campaign name | Lowercase, hyphens for spaces, include quarter/year | `apex-motors-q2-2026-awareness` |

### Recommended Parameters (include when relevant)
| Parameter | Purpose | Convention | Example |
|-----------|---------|------------|---------|
| `utm_content` | Ad creative variant | Lowercase, describe the creative | `300x250-blue-cta`, `video-30s-hero` |
| `utm_term` | Keyword/targeting | Lowercase, describe targeting | `sports-enthusiasts`, `retargeting-30d` |

### Convention Rules (ENFORCE THESE)
1. **All lowercase** — Never use uppercase in UTM values. `Display` → `display`.
2. **No spaces** — Use hyphens. `Spring Sale` → `spring-sale`.
3. **No special characters** — Only `a-z`, `0-9`, `-`. No underscores in values (underscores OK in parameter names).
4. **Consistent source naming** — Always use `cm360` for Campaign Manager 360 traffic, never `dcm`, `doubleclick`, or `google-cm360`.
5. **Include temporal context** — Campaign names should include quarter and year: `brand-awareness-q2-2026`.
6. **Match CM360 naming** — UTM campaign name should align with the CM360 campaign name (hyphenated, lowercase version).

### CM360 Macro Integration
When building URLs for CM360 placements, these macros are auto-replaced at serve time:

| Macro | Expands To | When to Use |
|-------|-----------|-------------|
| `%ebuy!` | Placement name | Dynamic placement identification |
| `%eadv!` | Advertiser ID | Advertiser-level tracking |
| `%ecid!` | Campaign ID | Campaign-level tracking |
| `%epid!` | Placement ID | Placement-level tracking |
| `%eaid!` | Ad ID | Ad-level tracking |
| `%esid!` | Site ID | Site-level tracking |
| `%n` | Cache buster (random number) | Always append to prevent caching |

### URL Construction Template
```
https://www.example.com/landing-page
  ?utm_source=cm360
  &utm_medium=display
  &utm_campaign={campaign-name-q#-year}
  &utm_content={creative-description}
  &utm_term={targeting-description}
  &cm_placementid=%epid!
  &cm_campaignid=%ecid!
  &cm_creative=%eaid!
  &cb=%n
```

### Common Mistakes to Catch
1. **Mixed case** — `utm_source=CM360` → suggest `utm_source=cm360`
2. **Spaces in values** — `utm_campaign=Spring Sale` → suggest `utm_campaign=spring-sale`
3. **Missing utm_source or utm_medium** — These are required for GA4 attribution
4. **Using `dcm` instead of `cm360`** — Historical name, standardize on `cm360`
5. **No cache buster** — CM360 URLs need `&cb=%n` or `&ord=%n` to prevent caching
6. **Duplicate parameters** — Check for `?` appearing twice in URL
7. **Missing `https://`** — Landing page URLs must be HTTPS

### Integration with Kiki's Workflow
When Kiki creates or updates a landing page:
1. Check if the URL already has UTM parameters
2. If missing, suggest adding them following the conventions above
3. If present but non-compliant, suggest corrections
4. Always show the complete URL for user review before saving
5. Validate URL format (no broken encoding, proper `?` and `&` usage)
