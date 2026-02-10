import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'adtraffic-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;
