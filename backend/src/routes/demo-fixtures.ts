/**
 * Demo-mode fixture endpoints (design §4 Demo mode). Mounted only when
 * DEMO_MODE=true. Mock clickTag URLs and QA click-test jobs point here, so the
 * full click chain resolves offline:
 *   /demo/click/:id → 302 → /demo/hop/:adId → 302 →
 *   /demo/landing/:advertiserId?<expected query, macros expanded>&ap_dest=<host+path>
 *
 * NOT part of the API surface — no auth, demo data only, never mounted live.
 */

import { Router } from 'express';
import type { CM360Ad } from '@adtraffic/shared';
import { mockStore } from '../cm360/mock-data-store.js';
import { assessAd } from '../qa/click-resolver.js';
import { demoFixtureBase } from '../qa/demo-base.js';

const router = Router();

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>` +
    `<body style="font-family:system-ui;max-width:640px;margin:40px auto"><h1>${esc(title)}</h1>${body}</body></html>`;
}

/** Resolve an ad by id, falling back to "first ad assigned to this placement id"
 * (mock tags are exported per placement — see mock-data-store.generateTags). */
function findAd(id: string): CM360Ad | undefined {
  const direct = mockStore.getAd(id);
  if (direct) return direct;
  return mockStore
    .listAds({ maxResults: 500 })
    .find((ad) => ad.placementAssignments.some((p) => p.placementId === id));
}

/** Expand the verified CM360 macro table the way serving would (demo stand-in). */
export function expandCm360Macros(
  url: string,
  ids: { campaignId?: string; placementId?: string; adId?: string; creativeId?: string; advertiserId?: string; siteId?: string },
): string {
  return url
    .replace(/%ebuy!/g, ids.campaignId ?? 'demo')
    .replace(/%epid!/g, ids.placementId ?? 'demo')
    .replace(/%eaid!/g, ids.adId ?? 'demo')
    .replace(/%ecid!/g, ids.creativeId ?? 'demo')
    .replace(/%eadv!/g, ids.advertiserId ?? 'demo')
    .replace(/%esid!/g, ids.siteId ?? 'demo')
    .replace(/%n(?![\w])/g, String(Math.floor(Math.random() * 1e9)))
    .replace(/%g(?![\w])/g, 'demo');
}

/** Map an expected click-through URL onto the landing fixture: same query
 * (param diff stays meaningful), original destination carried as ap_dest.
 * Used by BOTH the hop redirect and the QA job builder so expected === actual
 * for a healthy configuration. */
export function mapExpectedToDemoLanding(expectedUrl: string, advertiserId: string, base: string): string {
  const qIndex = expectedUrl.indexOf('?');
  const query = qIndex === -1 ? '' : expectedUrl.slice(qIndex + 1);
  const dest = encodeURIComponent(qIndex === -1 ? expectedUrl : expectedUrl.slice(0, qIndex));
  return `${base}/demo/landing/${advertiserId}?${query ? `${query}&` : ''}ap_dest=${dest}`;
}

router.get('/demo/click/:id', (req, res) => {
  const ad = findAd(req.params['id']);
  if (!ad) {
    res.status(404).type('html').send(page('Unknown ad or placement', '<p>Nothing trafficked resolves to this id.</p>'));
    return;
  }
  res.redirect(302, `/demo/hop/${ad.id}`);
});

router.get('/demo/hop/:adId', (req, res) => {
  const ad = mockStore.getAd(req.params['adId']);
  const campaign = ad ? mockStore.getCampaign(ad.campaignId) : undefined;
  if (!ad || !campaign) {
    res.status(404).type('html').send(page('Unknown ad', '<p>No such ad in the demo dataset.</p>'));
    return;
  }
  const advertiserId = campaign.advertiserId;
  const advertiser = mockStore.getAdvertiser(advertiserId);
  const landingPages = mockStore.listLandingPages({ advertiserId, maxResults: 100 });
  const creatives = new Map(mockStore.listCreatives({ advertiserId, maxResults: 100 }).map((c) => [c.id, c]));
  const assessment = assessAd({ ad, campaign, ...(advertiser ? { advertiser } : {}), landingPages, creatives });
  if (!assessment.expectedUrl) {
    // A real misconfiguration — let the click test observe the failure honestly.
    res.status(404).type('html').send(page('No click-through', `<p>Ad "${esc(ad.name)}" has no resolvable click-through URL.</p>`));
    return;
  }
  const expanded = expandCm360Macros(assessment.expectedUrl, {
    campaignId: campaign.id,
    placementId: ad.placementAssignments[0]?.placementId,
    adId: ad.id,
    creativeId: ad.creativeRotation.creativeAssignments[0]?.creativeId,
    advertiserId,
  });
  res.redirect(302, mapExpectedToDemoLanding(expanded, advertiserId, demoFixtureBase()));
});

router.get('/demo/landing/:advertiserId', (req, res) => {
  const advertiser = mockStore.getAdvertiser(req.params['advertiserId']);
  const rows = Object.entries(req.query)
    .map(([key, value]) => {
      const rendered = typeof value === 'string' ? value : JSON.stringify(value);
      return `<tr><td><code>${esc(key)}</code></td><td>${esc(rendered)}</td></tr>`;
    })
    .join('');
  res.status(200).type('html').send(page(
    advertiser?.name ?? 'Demo advertiser',
    '<p>AdTraffic demo landing page — this fixture stands in for the real landing page, which uses a fabricated domain.</p>' +
    `<table border="1" cellpadding="6"><tr><th>param</th><th>value</th></tr>${rows}</table>`,
  ));
});

export default router;
