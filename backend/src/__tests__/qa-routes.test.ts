import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db, schema } from '../db/index.js';
import { createRun, saveChecks, saveEvidence } from '../qa/qa-store.js';

// Switchable authenticated caller — real roles module stays in play.
let currentUser = { userId: '', role: 'junior' };
vi.mock('../auth/middleware.js', () => ({
  requireAuth: (req: { user?: { userId: string; email: string; role: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: currentUser.userId, email: 'qa@test.com', role: currentUser.role };
    next();
  },
}));

const { default: qaRouter } = await import('../routes/qa.js');
const app = express();
app.use(express.json());
app.use('/api/v1', qaRouter);

let ownerId: string;
let otherId: string;
let ownerRunId: string;
let otherRunId: string;

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.users).values({
    id, email: `${id}@test.com`, passwordHash: 'hashed', name: 'QA Routes',
    createdAt: new Date(), updatedAt: new Date(),
  });
  return id;
}

beforeEach(async () => {
  await db.delete(schema.qaChecks);
  await db.delete(schema.qaEvidence);
  await db.delete(schema.qaRuns);
  await db.delete(schema.auditLogs);
  // conversations.userId → users.id is NOT ON DELETE cascade, so any conversation
  // left by another test file (e.g. pagination) blocks `delete from users`. Wipe
  // conversations first, matching every other global-wipe suite. (messages cascade.)
  await db.delete(schema.conversations);
  await db.delete(schema.users);
  ownerId = await makeUser();
  otherId = await makeUser();
  const ownerRun = await createRun({
    userId: ownerId, conversationId: 'conv-owner', trigger: 'auto', retentionDays: 30,
    touched: [{ toolName: 'cm360_update_ad', entityType: 'ad', entityId: '2001' }],
  });
  ownerRunId = ownerRun.id;
  await saveChecks(ownerRunId, [{
    checkKey: 'config.click_through.ad:2001', category: 'config', status: 'pass', message: 'resolves',
  }]);
  const otherRun = await createRun({
    userId: otherId, conversationId: 'conv-other', trigger: 'auto', retentionDays: 30, touched: [],
  });
  otherRunId = otherRun.id;
});

describe('GET /api/v1/qa/runs', () => {
  it('returns only the caller\'s runs by default', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get('/api/v1/qa/runs');
    expect(res.status).toBe(200);
    expect(res.body.runs.map((r: { runId: string }) => r.runId)).toEqual([ownerRunId]);
  });

  it('filters by conversationId', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get('/api/v1/qa/runs?conversationId=conv-none');
    expect(res.status).toBe(200);
    expect(res.body.runs).toEqual([]);
  });

  it('403s requesterId for a caller without canApproveOthers (junior)', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get(`/api/v1/qa/runs?requesterId=${otherId}`);
    expect(res.status).toBe(403);
  });

  it('lets an approver (senior) list another user\'s runs via requesterId', async () => {
    currentUser = { userId: ownerId, role: 'senior' };
    const res = await request(app).get(`/api/v1/qa/runs?requesterId=${otherId}`);
    expect(res.status).toBe(200);
    expect(res.body.runs.map((r: { runId: string }) => r.runId)).toEqual([otherRunId]);
  });
});

describe('GET /api/v1/qa/runs/:id', () => {
  it('returns the full report with checks for the owner', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get(`/api/v1/qa/runs/${ownerRunId}`);
    expect(res.status).toBe(200);
    expect(res.body.run.advisory).toBe(true);
    expect(res.body.run.checks[0]!.checkKey).toBe('config.click_through.ad:2001');
  });

  it('404s another user\'s run for a junior caller (no existence leak)', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get(`/api/v1/qa/runs/${otherRunId}`);
    expect(res.status).toBe(404);
  });

  it('returns another user\'s run for an approver (senior)', async () => {
    currentUser = { userId: ownerId, role: 'senior' };
    const res = await request(app).get(`/api/v1/qa/runs/${otherRunId}`);
    expect(res.status).toBe(200);
    expect(res.body.run.runId).toBe(otherRunId);
  });

  it('404s an unknown id', async () => {
    currentUser = { userId: ownerId, role: 'senior' };
    const res = await request(app).get(`/api/v1/qa/runs/${randomUUID()}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/qa/runs/:id/evidence/:evidenceId', () => {
  let evidenceId: string;
  beforeEach(async () => {
    evidenceId = await saveEvidence(ownerRunId, 'click:ad:2001', 'image/png', Buffer.from('png-bytes'));
  });

  it('serves the bytes with the stored content type for the owner', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get(`/api/v1/qa/runs/${ownerRunId}/evidence/${evidenceId}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.toString()).toBe('png-bytes');
  });

  it('404s another user\'s evidence for a junior; 200 for a senior', async () => {
    currentUser = { userId: otherId, role: 'junior' };
    expect((await request(app).get(`/api/v1/qa/runs/${ownerRunId}/evidence/${evidenceId}`)).status).toBe(404);
    currentUser = { userId: otherId, role: 'senior' };
    expect((await request(app).get(`/api/v1/qa/runs/${ownerRunId}/evidence/${evidenceId}`)).status).toBe(200);
  });

  it('404s when the evidence does not belong to the run in the path', async () => {
    currentUser = { userId: ownerId, role: 'junior' };
    const res = await request(app).get(`/api/v1/qa/runs/${randomUUID()}/evidence/${evidenceId}`);
    expect(res.status).toBe(404);
  });
});
