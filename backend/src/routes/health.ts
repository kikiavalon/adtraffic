import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'adtraffic-backend',
    timestamp: new Date().toISOString(),
  });
});

// Dev-only endpoint to test Sentry error capture
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug-sentry', () => {
    throw new Error('Sentry test error');
  });
}

export default router;
