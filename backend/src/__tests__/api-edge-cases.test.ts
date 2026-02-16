/**
 * API edge case tests — validates input validation, missing fields,
 * unknown routes, and boundary conditions across all endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

let mockCallCount = 0;
vi.mock('../claude/kiki-service.js', () => ({
  chat: vi.fn().mockImplementation(() => {
    mockCallCount++;
    return Promise.resolve({
      id: `mock-id-${mockCallCount}-${Date.now()}`,
      role: 'assistant',
      content: 'Mock response',
      timestamp: Date.now(),
    });
  }),
  clearConversation: vi.fn(),
}));

let authToken: string;

beforeEach(async () => {
  db.delete(schema.messages).run();
  db.delete(schema.conversations).run();
  db.delete(schema.users).run();

  const email = `edge-${Date.now()}@test.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Edge Tester' });
  authToken = res.body.token;
});

// ---------------------------------------------------------------------------
// 404 handling
// ---------------------------------------------------------------------------

describe('Unknown routes', () => {
  it('returns 404 for nonexistent GET route', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent POST route', async () => {
    const res = await request(app).post('/api/nonexistent').send({});
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Auth registration edge cases
// ---------------------------------------------------------------------------

describe('POST /api/auth/register — edge cases', () => {
  it('rejects empty body', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'valid@test.com', password: 'SecurePass123' });
    expect(res.status).toBe(400);
  });

  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'SecurePass123', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'valid@test.com', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('rejects exactly 7-character password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@test.com', password: '1234567', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('accepts exactly 8-character password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'eight@test.com', password: '12345678', name: 'Test' });
    expect(res.status).toBe(201);
  });

  it('rejects email without @ sign', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'SecurePass123', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('rejects empty string name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'empty@test.com', password: 'SecurePass123', name: '' });
    expect(res.status).toBe(400);
  });

  it('returns token and user object on success (no sensitive fields)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'clean@test.com', password: 'SecurePass123', name: 'Clean' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.email).toBe('clean@test.com');
    expect(res.body.user.name).toBe('Clean');
    // Must never expose password hash
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Auth login edge cases
// ---------------------------------------------------------------------------

describe('POST /api/auth/login — edge cases', () => {
  it('rejects empty body', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  it('returns same error for wrong email and wrong password', async () => {
    // Register a user
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'timing@test.com', password: 'SecurePass123', name: 'Timing' });

    // Wrong email
    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'SecurePass123' });

    // Wrong password
    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: 'timing@test.com', password: 'WrongPassword1' });

    // Same error message for both (prevents email enumeration)
    expect(wrongEmail.body.error).toBe('Invalid email or password');
    expect(wrongPass.body.error).toBe('Invalid email or password');
    expect(wrongEmail.status).toBe(401);
    expect(wrongPass.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Chat API edge cases
// ---------------------------------------------------------------------------

describe('POST /api/chat — edge cases', () => {
  it('rejects request without auth', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ conversationId: 'test', message: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test', message: '' });
    expect(res.status).toBe(400);
  });

  it('rejects missing conversationId', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ message: 'Hello' });
    expect(res.status).toBe(400);
  });

  it('rejects missing message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'test' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Conversations API edge cases
// ---------------------------------------------------------------------------

describe('Conversations API — edge cases', () => {
  it('GET /api/conversations/:id/messages returns empty for unknown ID', async () => {
    const res = await request(app)
      .get('/api/conversations/unknown-id-12345/messages')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
  });

  it('DELETE /api/conversations/:id succeeds even if conversation does not exist', async () => {
    const res = await request(app)
      .delete('/api/conversations/never-existed')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('conversation title is set from first user message', async () => {
    await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'title-test', message: 'What advertisers exist?' });

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].title).toBe('What advertisers exist?');
  });

  it('multiple conversations are returned in order', async () => {
    await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'conv-older', message: 'First chat' });

    // Ensure different updatedAt timestamps (DB has second-level precision)
    await new Promise((r) => setTimeout(r, 1100));

    await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId: 'conv-newer', message: 'Second chat' });

    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.conversations).toHaveLength(2);
    // Newer first
    expect(res.body.conversations[0].id).toBe('conv-newer');
    expect(res.body.conversations[1].id).toBe('conv-older');
  });
});

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

describe('GET /health — validation', () => {
  it('returns expected shape', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('adtraffic-backend');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('returns valid ISO timestamp', async () => {
    const res = await request(app).get('/health');
    const date = new Date(res.body.timestamp);
    expect(date.getTime()).not.toBeNaN();
    // Timestamp should be recent (within 5 seconds)
    expect(Date.now() - date.getTime()).toBeLessThan(5000);
  });
});
