import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, schema } from '../db/index.js';

describe('Auth API', () => {
  beforeEach(() => {
    // Clear users table before each test
    db.delete(schema.users).run();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@agency.com',
          password: 'SecurePass123',
          name: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@agency.com');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@agency.com', password: 'SecurePass123', name: 'User 1' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@agency.com', password: 'DifferentPass456', name: 'User 2' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@agency.com', password: 'short', name: 'User' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'SecurePass123', name: 'User' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'login@agency.com', password: 'SecurePass123', name: 'Login User' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@agency.com', password: 'SecurePass123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@agency.com');
    });

    it('rejects wrong password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'wrong@agency.com', password: 'SecurePass123', name: 'User' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@agency.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@agency.com', password: 'Whatever123' });

      expect(res.status).toBe(401);
    });
  });
});
