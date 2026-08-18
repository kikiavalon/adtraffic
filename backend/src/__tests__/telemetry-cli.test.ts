import { describe, it, expect } from 'vitest';
import { parseYesNo } from '../telemetry/cli.js';

describe('parseYesNo', () => {
  it('returns the default on empty input', () => {
    expect(parseYesNo('', false)).toBe(false);
    expect(parseYesNo('   ', true)).toBe(true);
  });
  it('accepts y/yes (case-insensitive) as true', () => {
    expect(parseYesNo('y', false)).toBe(true);
    expect(parseYesNo('Yes', false)).toBe(true);
  });
  it('treats anything else as false', () => {
    expect(parseYesNo('n', true)).toBe(false);
    expect(parseYesNo('nope', true)).toBe(false);
  });
});
