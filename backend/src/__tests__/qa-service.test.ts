import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, schema } from '../db/index.js';
import { runTurnQa, sweepCampaign } from '../qa/qa-service.js';
import { recordQaWrite } from '../qa/qa-recorder.js';
import { fetchCampaignContext } from '../qa/click-resolver.js';
import { mockStore } from '../cm360/mock-data-store.js';
import { getDefaultFlags } from '../feature-flags/flag-registry.js';

let testUserId: string;

beforeEach(async () => {
  // Children before users (audit_logs FK has no cascade — see qa-store.test.ts note)
  await db.delete(schema.qaChecks);
  await db.delete(schema.qaRuns);
  await db.delete(schema.approvalQueue);
  await db.delete(schema.auditLogs);
  await db.delete(schema.messages);
  await db.delete(schema.conversations);
  await db.delete(schema.users);
  testUserId = randomUUID();
  await db.insert(schema.users).values({
    id: testUserId, email: `${testUserId}@test.com`, passwordHash: 'hashed', name: 'QA Test',
    createdAt: new Date(), updatedAt: new Date(),
  });
});

function qaFlags() {
  return { ...getDefaultFlags(), 'qa.enabled': true };
}

describe('sweepCampaign', () => {
  it('produces per-ad, per-placement, campaign-date, and source-consistency checks', async () => {
    const campaign = mockStore.listCampaigns()[0]!;
    const ctx = (await fetchCampaignContext('p', campaign.id))!;
    const checks = sweepCampaign(ctx);
    expect(checks.some((c) => c.checkKey === 'config.campaign_dates')).toBe(true);
    expect(checks.some((c) => c.checkKey.startsWith('config.click_through.ad:'))).toBe(true);
    expect(checks.some((c) => c.checkKey.startsWith('config.placement_has_ad.placement:'))).toBe(true);
    expect(checks.some((c) => c.checkKey === 'tracking.source_consistency' || c.checkKey === 'utm.source_mixed')).toBe(true);
  });
});

describe('runTurnQa', () => {
  it('returns null when no writes were recorded', async () => {
    expect(await runTurnQa({ conversationId: `conv-${randomUUID()}`, userId: testUserId, flags: qaFlags() })).toBeNull();
  });

  it('returns null (and drops recorded writes) when qa.enabled is false', async () => {
    const conversationId = `conv-${randomUUID()}`;
    recordQaWrite(conversationId, { toolName: 'cm360_update_ad', toolInput: { profileId: 'p', adId: '1' }, result: null, recordedAt: Date.now() });
    expect(await runTurnQa({ conversationId, userId: testUserId, flags: getDefaultFlags() })).toBeNull();
    // second call finds nothing — the disabled run drained the recorder
    expect(await runTurnQa({ conversationId, userId: testUserId, flags: qaFlags() })).toBeNull();
  });

  it('runs touched-entity checks + campaign sweep for a recorded ad write', async () => {
    const conversationId = `conv-${randomUUID()}`;
    const campaign = mockStore.listCampaigns()[0]!;
    const ad = mockStore.listAds({ campaignId: campaign.id })[0]!;
    recordQaWrite(conversationId, {
      toolName: 'cm360_update_ad',
      toolInput: { profileId: 'p', adId: ad.id, name: ad.name },
      result: ad,
      recordedAt: Date.now(),
    });
    const report = await runTurnQa({ conversationId, userId: testUserId, flags: qaFlags(), trigger: 'auto' });
    expect(report).not.toBeNull();
    expect(report!.advisory).toBe(true);
    expect(report!.campaignId).toBe(campaign.id);
    expect(report!.touched[0]).toMatchObject({ entityType: 'ad', entityId: ad.id });
    expect(report!.checks.some((c) => c.checkKey === `config.click_through.ad:${ad.id}`)).toBe(true);
    expect(['passed', 'warned', 'failed']).toContain(report!.status);

    // Persisted + audit events written
    const runs = await db.select().from(schema.qaRuns);
    expect(runs.length).toBe(1);
    expect(runs[0]!.status).toBe(report!.status);
    const audits = await db.select().from(schema.auditLogs);
    const types = audits.map((a) => a.eventType);
    expect(types).toContain('qa_run_started');
    expect(types).toContain('qa_run_completed');
  });

  it('validates a landing-page write directly when no campaign scope is derivable', async () => {
    const conversationId = `conv-${randomUUID()}`;
    const advertiser = mockStore.listAdvertisers()[0]!;
    recordQaWrite(conversationId, {
      toolName: 'cm360_create_landing_page',
      toolInput: { profileId: 'p', advertiserId: advertiser.id, name: 'LP', url: 'http://insecure.com/?utm_source=CM360' },
      result: { id: 'lp-new', advertiserId: advertiser.id, url: 'http://insecure.com/?utm_source=CM360' },
      recordedAt: Date.now(),
    });
    const report = await runTurnQa({ conversationId, userId: testUserId, flags: qaFlags() });
    expect(report).not.toBeNull();
    expect(report!.status).toBe('failed'); // http + partial tagging
    expect(report!.checks.some((c) => c.checkKey.startsWith('url.not_https'))).toBe(true);
  });

  it('never throws — an internal failure yields an error-status run', async () => {
    const conversationId = `conv-${randomUUID()}`;
    recordQaWrite(conversationId, {
      toolName: 'cm360_update_ad',
      toolInput: { profileId: 'p', adId: 'no-such-ad' },
      result: null,
      recordedAt: Date.now(),
    });
    const report = await runTurnQa({ conversationId, userId: testUserId, flags: qaFlags() });
    expect(report).not.toBeNull(); // scope unresolvable → skipped check, not a crash
    expect(report!.checks.some((c) => c.status === 'skipped' || c.status === 'fail')).toBe(true);
  });

  it('produces no run for QA-irrelevant writes (e.g. report/user-role tools)', async () => {
    const conversationId = `conv-${randomUUID()}`;
    recordQaWrite(conversationId, {
      toolName: 'cm360_create_report',
      toolInput: { profileId: 'p', name: 'Weekly pacing' },
      result: { id: 'r-1', name: 'Weekly pacing' },
      recordedAt: Date.now(),
    });
    expect(await runTurnQa({ conversationId, userId: testUserId, flags: qaFlags() })).toBeNull();
    const runs = await db.select().from(schema.qaRuns);
    expect(runs.length).toBe(0); // no near-empty "sweep skipped" run rows
  });
});
