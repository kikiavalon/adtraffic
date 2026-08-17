import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import demoFixturesRouter, { expandCm360Macros, mapExpectedToDemoLanding } from '../routes/demo-fixtures.js';
import { mockStore } from '../cm360/mock-data-store.js';

const app = express();
app.use(demoFixturesRouter);

function seededAd() {
  // Advertiser 0 (Apex) — has suffix utm_content=suffix-%epid! (Phase 0 seed)
  const advertiser = mockStore.listAdvertisers()[0]!;
  const campaign = mockStore.listCampaigns({ advertiserId: advertiser.id })[0]!;
  const ad = mockStore.listAds({ campaignId: campaign.id })[0]!;
  return { advertiser, campaign, ad };
}

describe('expandCm360Macros / mapExpectedToDemoLanding', () => {
  it('expands the verified macro set and leaves nothing behind', () => {
    const out = expandCm360Macros('https://x.com/?p=%epid!&a=%eaid!&c=%ebuy!&n=%n', {
      campaignId: '101', placementId: '3001', adId: '2001',
    });
    expect(out).toContain('p=3001');
    expect(out).toContain('a=2001');
    expect(out).toContain('c=101');
    expect(out).not.toMatch(/%e[a-z]+!|%n/);
  });

  it('maps an expected URL onto the landing fixture, preserving the query + ap_dest', () => {
    const mapped = mapExpectedToDemoLanding('https://www.apexmotors.com/offers?utm_source=cm360', 'adv-1', 'http://localhost:3001');
    expect(mapped).toBe(`http://localhost:3001/demo/landing/adv-1?utm_source=cm360&ap_dest=${encodeURIComponent('https://www.apexmotors.com/offers')}`);
  });
});

describe('demo fixture chain', () => {
  it('/demo/click/:adId 302s to the hop', async () => {
    const { ad } = seededAd();
    const res = await request(app).get(`/demo/click/${ad.id}`);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe(`/demo/hop/${ad.id}`);
  });

  it('accepts a placement id too (mock tags are exported per placement)', async () => {
    const { ad } = seededAd();
    const placementId = ad.placementAssignments[0]!.placementId;
    const res = await request(app).get(`/demo/click/${placementId}`);
    expect(res.status).toBe(302);
    expect(res.headers['location']).toMatch(/^\/demo\/hop\//);
  });

  it('/demo/hop/:adId 302s to the landing fixture with UTMs and macros expanded', async () => {
    const { ad, campaign } = seededAd();
    const res = await request(app).get(`/demo/hop/${ad.id}`);
    expect(res.status).toBe(302);
    const location = res.headers['location']!;
    expect(location).toContain(`/demo/landing/${campaign.advertiserId}`);
    expect(location).toContain('utm_source=cm360');
    expect(location).toContain('ap_dest=');
    expect(location).not.toContain('%e'); // macros expanded, not leaked
  });

  it('/demo/landing/:advertiserId renders a non-blank page echoing the params', async () => {
    const { advertiser } = seededAd();
    const res = await request(app).get(`/demo/landing/${advertiser.id}?utm_source=cm360&ap_dest=x`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(advertiser.name);
    expect(res.text).toContain('utm_source');
  });

  it('404s an unknown id with an HTML body (a legitimately failing demo click)', async () => {
    const res = await request(app).get('/demo/click/no-such-id');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('html');
  });
});
