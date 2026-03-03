/**
 * Tests for Kiki's system prompt — validates guardrails, persona, and critical instructions.
 */

import { describe, it, expect } from 'vitest';
import { KIKI_SYSTEM_PROMPT } from '../claude/system-prompt.js';

describe('System prompt structure', () => {
  it('is a non-empty string', () => {
    expect(typeof KIKI_SYSTEM_PROMPT).toBe('string');
    expect(KIKI_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('identifies Kiki by name', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('Kiki');
  });

  it('identifies the product as AdTraffic.ai', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('AdTraffic.ai');
  });

  it('identifies the platform as CM360', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/CM360|Campaign Manager 360/);
  });
});

describe('Guardrails — write operation safety (HARD RULE)', () => {
  it('has a dedicated hard rule section for confirmation', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/HARD RULE.*Always Confirm/i);
  });

  it('states the rule can never be broken', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/NEVER be broken/i);
  });

  it('requires showing a preview before any write', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/show.*preview.*exactly what/i);
  });

  it('requires waiting for explicit user approval', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/wait.*user.*explicitly/i);
  });

  it('prohibits executing write in the same response as the preview', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/same response.*preview/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/always wait for the next user message/i);
  });

  it('states that a user request is not the confirmation', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/request is not the confirmation/i);
  });

  it('requires confirming each operation in bulk scenarios', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/confirm the full list/i);
  });
});

describe('Guardrails — data integrity', () => {
  it('prohibits fabricating data', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/NEVER.*fabricat/i);
  });

  it('instructs to use tools for real data', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/tool/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/don.*t guess/i);
  });
});

describe('Operational instructions', () => {
  it('instructs to call list_profiles first', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/list_profiles.*first/i);
  });

  it('specifies date format (YYYY-MM-DD)', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('YYYY-MM-DD');
  });

  it('instructs to format results as tables', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/table/i);
  });

  it('instructs to ask clarifying questions', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/clarif/i);
  });
});

describe('IO Document Processing instructions', () => {
  it('contains the IO Document Processing heading', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('## IO Document Processing');
  });

  it('instructs to identify placement specifications', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('placement specifications');
  });

  it('instructs to confirm accuracy before proceeding', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('confirm accuracy');
  });

  it('prohibits creating placements without confirmation', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('NEVER create placements without');
  });

  it('includes table format headers for extracted IO data', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('Site');
    expect(KIKI_SYSTEM_PROMPT).toContain('Size');
    expect(KIKI_SYSTEM_PROMPT).toContain('Start');
    expect(KIKI_SYSTEM_PROMPT).toContain('End');
    expect(KIKI_SYSTEM_PROMPT).toContain('Rate');
    expect(KIKI_SYSTEM_PROMPT).toContain('Notes');
  });
});

describe('UTM parameter conventions', () => {
  it('contains the UTM Parameter Conventions heading', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('## UTM Parameter Conventions');
  });

  it('includes utm_source=cm360 convention', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('utm_source=cm360');
  });

  it('includes cache buster macro %n', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('%n');
  });

  it('includes suggest corrections guidance', () => {
    expect(KIKI_SYSTEM_PROMPT).toContain('suggest corrections');
  });
});

describe('Personality', () => {
  it('defines professional tone', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/professional/i);
  });

  it('defines concise style', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/concise/i);
  });

  it('defines proactive behavior', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/proactive/i);
  });

  it('defines honesty', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/honest/i);
  });

  it('defines directed communication — not menu-driven', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/direct.*not menu-driven/i);
  });

  it('defines factual requirement — suggestions must reflect real CM360 behavior', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/factual/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/how CM360 actually works/i);
  });
});

describe('CM360 workflow rules', () => {
  it('requires creative sizes to match placement sizes', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/creative sizes MUST match placement sizes/i);
  });

  it('prohibits suggesting mismatched sizes', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/never suggest.*mismatched sizes/i);
  });

  it('defines sequential trafficking workflow', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/trafficking workflow is sequential/i);
  });

  it('prohibits skipping workflow steps', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/cannot skip steps/i);
  });

  it('states creatives are uploaded by the user, not created by Kiki', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/creatives are uploaded by the user/i);
  });
});

describe('Capability boundaries', () => {
  it('explicitly states Kiki cannot create creative assets', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/cannot create or upload creative assets/i);
  });

  it('states tags require the full chain to exist', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/cannot generate tags until ads exist/i);
  });
});
