import { describe, it, expect, beforeEach } from 'vitest';
import {
  metricsRegistry,
  httpRequestsTotal,
  httpRequestDuration,
  claudeApiRequestsTotal,
  claudeApiTokensTotal,
  activeConnections,
  normalizeRoute,
} from '../lib/metrics.js';

describe('metrics', () => {
  beforeEach(async () => {
    // Reset all metrics between tests
    metricsRegistry.resetMetrics();
  });

  describe('registry', () => {
    it('exposes all expected metrics', async () => {
      const metrics = await metricsRegistry.getMetricsAsJSON();
      const metricNames = metrics.map((m) => m.name);
      expect(metricNames).toContain('http_requests_total');
      expect(metricNames).toContain('http_request_duration_seconds');
      expect(metricNames).toContain('claude_api_requests_total');
      expect(metricNames).toContain('claude_api_tokens_total');
      expect(metricNames).toContain('active_connections');
    });

    it('returns Prometheus-format text', async () => {
      const output = await metricsRegistry.metrics();
      expect(output).toContain('# HELP http_requests_total');
      expect(output).toContain('# TYPE http_requests_total counter');
    });

    it('includes service label in default labels', async () => {
      httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
      const output = await metricsRegistry.metrics();
      expect(output).toContain('service="adtraffic-backend"');
    });
  });

  describe('httpRequestsTotal', () => {
    it('increments counter for requests', async () => {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations', status_code: '200' });
      httpRequestsTotal.inc({ method: 'POST', route: '/api/v1/chat', status_code: '200' });
      httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/conversations', status_code: '200' });

      const metrics = await metricsRegistry.getMetricsAsJSON();
      const httpMetric = metrics.find((m) => m.name === 'http_requests_total');
      expect(httpMetric).toBeDefined();
    });
  });

  describe('httpRequestDuration', () => {
    it('records durations in histogram', async () => {
      httpRequestDuration.observe(
        { method: 'GET', route: '/api/v1/conversations', status_code: '200' },
        0.15,
      );
      httpRequestDuration.observe(
        { method: 'POST', route: '/api/v1/chat', status_code: '200' },
        1.5,
      );

      const output = await metricsRegistry.metrics();
      expect(output).toContain('http_request_duration_seconds_bucket');
    });
  });

  describe('claudeApiRequestsTotal', () => {
    it('tracks Claude API requests by model and status', async () => {
      claudeApiRequestsTotal.inc({ model: 'claude-haiku-4-5-20251001', status: 'success' });
      claudeApiRequestsTotal.inc({ model: 'claude-haiku-4-5-20251001', status: 'error' });

      const output = await metricsRegistry.metrics();
      expect(output).toContain('claude_api_requests_total');
    });
  });

  describe('claudeApiTokensTotal', () => {
    it('tracks token consumption by model and type', async () => {
      claudeApiTokensTotal.inc({ model: 'claude-haiku-4-5-20251001', type: 'input' }, 500);
      claudeApiTokensTotal.inc({ model: 'claude-haiku-4-5-20251001', type: 'output' }, 200);

      const output = await metricsRegistry.metrics();
      expect(output).toContain('claude_api_tokens_total');
    });
  });

  describe('activeConnections', () => {
    it('tracks gauge values', () => {
      activeConnections.inc();
      activeConnections.inc();
      activeConnections.dec();
      // Gauge should be at 1
    });
  });

  describe('normalizeRoute', () => {
    it('collapses UUIDs to :id', () => {
      expect(normalizeRoute('/api/v1/conversations/a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
        '/api/v1/conversations/:id',
      );
    });

    it('collapses UUIDs in middle of path', () => {
      expect(
        normalizeRoute(
          '/api/v1/conversations/a1b2c3d4-e5f6-7890-abcd-ef1234567890/messages',
        ),
      ).toBe('/api/v1/conversations/:id/messages');
    });

    it('collapses numeric IDs to :id', () => {
      expect(normalizeRoute('/api/v1/users/12345')).toBe('/api/v1/users/:id');
    });

    it('leaves paths without IDs unchanged', () => {
      expect(normalizeRoute('/api/v1/conversations')).toBe('/api/v1/conversations');
      expect(normalizeRoute('/health')).toBe('/health');
      expect(normalizeRoute('/metrics')).toBe('/metrics');
    });

    it('handles multiple ID segments', () => {
      expect(normalizeRoute('/api/v1/users/123/posts/456')).toBe('/api/v1/users/:id/posts/:id');
    });
  });
});
