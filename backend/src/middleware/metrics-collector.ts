import type { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
  normalizeRoute,
} from '../lib/metrics.js';

/**
 * Middleware that records HTTP request metrics for Prometheus.
 *
 * - Increments `http_requests_total` counter on response finish
 * - Observes `http_request_duration_seconds` histogram
 * - Tracks `active_connections` gauge
 * - Skips the /metrics endpoint itself to avoid self-referential metrics
 */
export function metricsCollectorMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Don't record metrics for the metrics endpoint itself
  if (req.path === '/metrics') {
    next();
    return;
  }

  activeConnections.inc();
  const startTime = process.hrtime.bigint();

  res.on('close', () => {
    activeConnections.dec();

    const durationNs = process.hrtime.bigint() - startTime;
    const durationSeconds = Number(durationNs) / 1_000_000_000;

    const route = normalizeRoute(req.path);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
}
