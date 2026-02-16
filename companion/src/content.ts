import type { CM360PageContext } from './types.js';
import { extractContextFromHash, extractContextFromDOM, mergeContexts } from './context-extractor.js';

/**
 * Inject a floating "Open Kiki" button on CM360 pages.
 */
function injectFloatingButton(context: CM360PageContext): void {
  // Don't inject twice
  if (document.getElementById('adtraffic-kiki-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'adtraffic-kiki-fab';
  fab.title = 'Open Kiki — AdTraffic.ai';

  // Style the floating action button
  Object.assign(fab.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
    cursor: 'pointer',
    zIndex: '999999',
    fontSize: '22px',
    fontWeight: '700',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
  });

  fab.textContent = 'K';

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
      const url = `${result.baseUrl}/?${params.toString()}`;
      window.open(url, '_blank');
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
  chrome.storage.local.set({ cm360Context: context });
  chrome.runtime.sendMessage({ type: 'CM360_CONTEXT', data: context });

  // Inject the floating button
  injectFloatingButton(context);

  // Re-extract on hash changes (CM360 uses hash-based routing)
  window.addEventListener('hashchange', () => {
    const updatedHash = extractContextFromHash(window.location.hash);
    const updatedDom = extractContextFromDOM();
    const updatedContext = mergeContexts(updatedHash, updatedDom);

    chrome.storage.local.set({ cm360Context: updatedContext });
    chrome.runtime.sendMessage({ type: 'CM360_CONTEXT', data: updatedContext });

    // Update the FAB's click handler with new context
    const existingFab = document.getElementById('adtraffic-kiki-fab');
    if (existingFab) {
      existingFab.remove();
    }
    injectFloatingButton(updatedContext);
  });
}

main();
