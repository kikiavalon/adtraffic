import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { requirePermission } from '../auth/roles.js';
import { listUsers, createUser, updateUserRole, setUserActive, DuplicateEmailError, UserNotFoundError, LastAdminError, SelfActionError } from '../auth/user-management.js';
import { logger } from '../lib/logger.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

const router = Router();

const mutateLimiter = createRateLimiter({ name: 'user-mgmt', windowMs: 60_000, maxRequests: 30 });

const RoleSchema = z.enum(['admin', 'senior', 'junior']);

const CreateUserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(200),
  role: RoleSchema,
});

/**
 * Admin user-management. Every route requires the canManageUsers permission
 * (admin role), so an agency admin can add employees and assign roles.
 */
router.get('/users', requireAuth, requirePermission('canManageUsers'), async (_req, res) => {
  try {
    res.json({ users: await listUsers() });
  } catch (error) {
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' } },
      'Error listing users',
    );
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', requireAuth, requirePermission('canManageUsers'), mutateLimiter, async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  try {
    const user = await createUser(parsed.data);
    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' } },
      'Error creating user',
    );
    res.status(500).json({ error: 'Failed to create user' });
  }
});

const UpdateRoleSchema = z.object({ role: RoleSchema });

router.patch('/users/:id', requireAuth, requirePermission('canManageUsers'), mutateLimiter, async (req, res) => {
  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  try {
    const user = await updateUserRole(req.params['id'] as string, parsed.data.role);
    res.json({ user });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (error instanceof LastAdminError) {
      res.status(409).json({ error: 'Cannot remove the last admin' });
      return;
    }
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' } },
      'Error updating user role',
    );
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Soft-delete: deactivate a user (they can no longer sign in; data is kept).
router.delete('/users/:id', requireAuth, requirePermission('canManageUsers'), mutateLimiter, async (req, res) => {
  try {
    const user = await setUserActive(req.params['id'] as string, false, req.user!.userId);
    res.json({ user });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (error instanceof SelfActionError) {
      res.status(409).json({ error: error.message });
      return;
    }
    if (error instanceof LastAdminError) {
      res.status(409).json({ error: 'Cannot deactivate the last admin' });
      return;
    }
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' } },
      'Error deactivating user',
    );
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

router.post('/users/:id/reactivate', requireAuth, requirePermission('canManageUsers'), mutateLimiter, async (req, res) => {
  try {
    const user = await setUserActive(req.params['id'] as string, true, req.user!.userId);
    res.json({ user });
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    logger.error(
      { err: { message: error instanceof Error ? error.message : 'Unknown error' } },
      'Error reactivating user',
    );
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
});

export default router;
