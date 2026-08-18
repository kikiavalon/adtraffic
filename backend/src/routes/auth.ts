import { Router } from 'express';
import { z } from 'zod';
import { register, login } from '../auth/auth-service.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

const router = Router();

const loginLimiter = createRateLimiter({ name: 'login', windowMs: 60_000, maxRequests: 10 });
const registerLimiter = createRateLimiter({ name: 'register', windowMs: 60_000, maxRequests: 5 });

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must not exceed 128 characters'),
  name: z.string().min(1, 'Name is required').max(200),
});

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

router.post('/auth/register', registerLimiter, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  try {
    const result = await register(parsed.data.email, parsed.data.password, parsed.data.name);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Email already registered') {
      // Return generic message to prevent email enumeration (CWE-209)
      res.status(409).json({ error: 'Registration failed' });
      return;
    }
    throw error;
  }
});

router.post('/auth/login', loginLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid email or password') {
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;
