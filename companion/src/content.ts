import type { CM360PageContext } from './types.js';
import { extractContextFromHash, extractContextFromDOM, mergeContexts } from './context-extractor.js';

/** Unique class name to scope FAB styles and avoid conflicts with host page */
const FAB_CLASS = 'adtraffic-kiki-fab';
const FAB_STYLE_ID = 'adtraffic-kiki-fab-style';

/**
 * Inject scoped CSS for the FAB if not already present.
 */
function ensureFabStyles(): void {
  if (document.getElementById(FAB_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FAB_STYLE_ID;
  style.textContent = `
    .${FAB_CLASS} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #fff;
      border: none;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
      cursor: pointer;
      z-index: 999999;
      font-size: 22px;
      font-weight: 700;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .${FAB_CLASS}:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Inject a floating "Open Kiki" button on CM360 pages.
 */
function injectFloatingButton(context: CM360PageContext): void {
  // Don't inject twice
  if (document.getElementById('adtraffic-kiki-fab')) return;

  ensureFabStyles();

  const fab = document.createElement('button');
  fab.id = 'adtraffic-kiki-fab';
  fab.className = FAB_CLASS;
  fab.title = 'Open Kiki — AdTraffic.ai';
  fab.textContent = 'K';

  // JS-based hover handlers for environments where CSS :hover may not apply
  // (e.g., programmatic testing). The CSS :hover rule handles real browser behavior.
  fab.addEventListener('mouseenter', () => {
    fab.style.transform = 'scale(1.1)';
    fab.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)';
  });
  fab.addEventListener('mouseleave', () => {
    fab.style.transform = 'scale(1)';
    fab.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.4)';
  });

  fab.addEventListener('click', () => {
    const params = new URLSearchParams();
    if (context.advertiserId) params.set('advertiserId', context.advertiserId);
    if (context.campaignId) params.set('campaignId', context.campaignId);

    // Read the base URL from storage, default to localhost dev server
    chrome.storage.local.get({ baseUrl: 'http://localhost:5173' }, (result) => {
      const baseUrl = String(result.baseUrl);
      // Validate URL is HTTP/HTTPS
      try {
        const parsed = new URL(baseUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          console.error('Invalid baseUrl protocol:', parsed.protocol);
          return;
        }
        const launchUrl = `${parsed.origin}${parsed.pathname}?${params.toString()}`;
        window.open(launchUrl, '_blank');
      } catch {
        console.error('Invalid baseUrl:', baseUrl);
      }
    });
  });

  document.body.appendChild(fab);
}

/**
 * Main entry point — runs at document_idle on CM360 pages.
 */
function main(): void {
  const hashContext = extractContextFromHash(window.location.hash);
  const domContext = extractContextFromDOM();
  const context = mergeContexts(hashContext, domContext);

  // Store context and notify background
  void chrome.storage.local.set({ cm360Context: context });
  try {
    void chrome.runtime.sendMessage({ type: 'CM360_CONTEXT', data: context });
  } catch {
    // Background worker not yet active — expected in MV3
  }

  // Inject the floating button
  injectFloatingButton(context);

  // Re-extract on hash changes (CM360 uses hash-based routing)
  window.addEventListener('hashchange', () => {
    const updatedHash = extractContextFromHash(window.location.hash);
    const updatedDom = extractContextFromDOM();
    const updatedContext = mergeContexts(updatedHash, updatedDom);

    void chrome.storage.local.set({ cm360Context: updatedContext });
    try {
      void chrome.runtime.sendMessage({ type: 'CM360_CONTEXT', data: updatedContext });
    } catch {
      // Background worker not yet active — expected in MV3
    }

    // Update the FAB's click handler with new context
    const existingFab = document.getElementById('adtraffic-kiki-fab');
    if (existingFab) {
      existingFab.remove();
    }
    injectFloatingButton(updatedContext);
  });
}

main();
