import { describe, it, expect } from 'vitest';
import { safeMarkdownUrl } from '../utils/markdown-url';

describe('safeMarkdownUrl', () => {
  const origin = window.location.origin;

  it('blocks external image sources (exfil beacon)', () => {
    expect(safeMarkdownUrl('http://attacker.example/?leak=secret', 'src')).toBe('');
    expect(safeMarkdownUrl('https://evil.test/pixel.gif', 'src')).toBe('');
  });

  it('allows same-origin and relative image sources', () => {
    expect(safeMarkdownUrl('/logo.png', 'src')).toBe('/logo.png');
    expect(safeMarkdownUrl(`${origin}/a.png`, 'src')).toBe(`${origin}/a.png`);
  });

  it('strips data: image sources (react-markdown default), which do not beacon anyway', () => {
    expect(safeMarkdownUrl('data:image/png;base64,AAAA', 'src')).toBe('');
  });

  it('leaves link hrefs to react-markdown default sanitization (external links allowed)', () => {
    expect(safeMarkdownUrl('https://example.com/page', 'href')).toBe('https://example.com/page');
  });

  it('still strips javascript: urls via the default transform', () => {
    expect(safeMarkdownUrl('javascript:alert(1)', 'href')).toBe('');
    expect(safeMarkdownUrl('javascript:alert(1)', 'src')).toBe('');
  });
});
