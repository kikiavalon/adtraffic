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

describe('Guardrails — write operation safety', () => {
  it('requires confirmation before write operations', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/confirm/i);
    expect(KIKI_SYSTEM_PROMPT).toMatch(/preview/i);
  });

  it('explicitly prohibits silent writes', () => {
    // Must contain a "NEVER" + "write" rule
    expect(KIKI_SYSTEM_PROMPT).toMatch(/NEVER.*write.*without/i);
  });

  it('requires preview before create/update/delete', () => {
    expect(KIKI_SYSTEM_PROMPT).toMatch(/preview.*before/i);
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
});
