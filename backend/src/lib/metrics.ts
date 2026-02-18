import { Registry, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Custom Prometheus registry (not the default global one).
 * Avoids test pollution and allows clean per-test resets.
 */
export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({ service: 'adtraffic-backend' });

/**
 * Total HTTP requests handled, labeled by method, route, and status code.
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

/**
 * HTTP request duration in seconds, labeled by method, route, and status code.
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Total Claude API requests, labeled by model and status (success/error).
 */
export const claudeApiRequestsTotal = new Counter({
  name: 'claude_api_requests_total',
  help: 'Total number of Claude API requests',
  labelNames: ['model', 'status'] as const,
  registers: [metricsRegistry],
});

/**
 * Total Claude API tokens consumed, labeled by model and type (input/output).
 */
export const claudeApiTokensTotal = new Counter({
  name: 'claude_api_tokens_total',
  help: 'Total Claude API tokens consumed',
  labelNames: ['model', 'type'] as const,
  registers: [metricsRegistry],
});

/**
 * Currently active HTTP connections.
 */
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of currently active HTTP connections',
  registers: [metricsRegistry],
});

/**
 * Normalize an Express route path to prevent Prometheus label cardinality explosion.
 *
 * Collapses:
 * - UUIDs (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`) → `:id`
 * - Numeric IDs (e.g., `/users/123`) → `:id`
 *
 * Examples:
 * - `/api/v1/conversations/a1b2c3d4-e5f6-7890-abcd-ef1234567890/messages` → `/api/v1/conversations/:id/messages`
 * - `/api/v1/conversations/123` → `/api/v1/conversations/:id`
 */
export function normalizeRoute(path: string): string {
  return path
    // Replace UUIDs first (more specific pattern)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace remaining numeric-only path segments
    .replace(/\/\d+/g, '/:id');
}
