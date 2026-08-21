import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { setKey, getStatus, clearKey, verifyKey } from '../claude/anthropic-key-service.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

const router = Router();
const KeySchema = z.object({ apiKey: z.string().min(20).max(200).startsWith('sk-ant-') });

// PUT verifies the key against Anthropic's API (an external network call), so cap
// it per IP to prevent abuse of that upstream call. No-op under NODE_ENV=test.
const anthropicKeyLimiter = createRateLimiter({ name: 'anthropic-key', windowMs: 60_000, maxRequests: 10 });

router.get('/settings/anthropic/status', requireAuth, async (req, res) => {
  res.json(await getStatus(req.user!.userId));
});

router.put('/settings/anthropic', anthropicKeyLimiter, requireAuth, async (req, res) => {
  const parsed = KeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "That doesn't look like a Claude API key (it should start with sk-ant-)." });
  let ok: boolean;
  try {
    ok = await verifyKey(parsed.data.apiKey);
  } catch {
    return res.status(502).json({ error: "Couldn't reach Anthropic to verify the key. Try again shortly." });
  }
  if (!ok) return res.status(400).json({ error: "That API key didn't work — check it and try again." });
  await setKey(req.user!.userId, parsed.data.apiKey);
  res.json(await getStatus(req.user!.userId));
});

router.delete('/settings/anthropic', requireAuth, async (req, res) => {
  await clearKey(req.user!.userId);
  res.json({ connected: false });
});

export default router;
