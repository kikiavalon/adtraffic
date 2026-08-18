import { describe, it, expect } from 'vitest';
import { getExtractionPrompt } from '../io/extraction-prompt.js';

describe('IO Extraction Prompt', () => {
  it('returns a non-empty system prompt string', () => {
    const prompt = getExtractionPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes TraffickingPlan JSON schema reference', () => {
    const prompt = getExtractionPrompt();
    expect(prompt).toContain('TraffickingPlan');
    expect(prompt).toContain('JSON');
  });

  it('includes all required top-level fields', () => {
    const prompt = getExtractionPrompt();
    expect(prompt).toContain('campaign');
    expect(prompt).toContain('placements');
    expect(prompt).toContain('confidence');
  });

  it('includes instructions for confidence levels', () => {
    const prompt = getExtractionPrompt();
    expect(prompt).toContain('high');
    expect(prompt).toContain('medium');
    expect(prompt).toContain('low');
  });

  it('includes instructions for warnings', () => {
    const prompt = getExtractionPrompt();
    expect(prompt).toContain('warnings');
  });

  it('includes rate type enums', () => {
    const prompt = getExtractionPrompt();
    expect(prompt).toContain('CPM');
    expect(prompt).toContain('CPC');
    expect(prompt).toContain('CPA');
    expect(prompt).toContain('Flat');
  });
});
