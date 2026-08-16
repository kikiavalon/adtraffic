/**
 * Tests for the agent capability manifest endpoints.
 * These endpoints serve public, unauthenticated data for IAB Agent Registry
 * compliance and agent interoperability.
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';

// Mock audit-service to prevent fire-and-forget DB writes
vi.mock('../audit/audit-service.js', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAuditLog: vi.fn().mockResolvedValue([]),
  hashIp: vi.fn().mockReturnValue('test-hash'),
  VALID_EVENT_TYPES: ['message_sent', 'message_received', 'tool_executed', 'session_started', 'session_ended', 'button_clicked', 'tool_confirmed', 'tool_rejected', 'rate_limit_hit', 'daily_limit_reached', 'error', 'approval_requested', 'approval_granted'],
}));

describe('GET /api/v1/agent/manifest', () => {
  it('returns the agent manifest without authentication', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.name).toBe('AdTraffic.ai Kiki');
    expect(res.body.version).toBe('1.0.0');
  });

  it('includes vendor information', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.vendor).toBeDefined();
    expect(res.body.vendor.name).toBe('AdTraffic.ai');
    expect(res.body.vendor.url).toBe('https://adtraffic.ai');
    expect(res.body.vendor.security_contact).toBe('security@adtraffic.ai');
    expect(res.body.vendor.privacy_contact).toBe('privacy@adtraffic.ai');
  });

  it('includes AI system disclosure', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.ai_system).toBeDefined();
    expect(res.body.ai_system.disclosure).toBe(true);
    expect(res.body.ai_system.provider).toBe('Anthropic');
    expect(res.body.ai_system.model_family).toBe('Claude');
    expect(res.body.ai_system.human_in_the_loop).toBe(true);
    expect(res.body.ai_system.autonomous_actions).toBe(false);
  });

  it('includes CM360 platform details', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.platform.name).toBe('Google Campaign Manager 360');
    expect(res.body.platform.api_version).toBe('v5');
    expect(res.body.platform.auth_method).toBe('oauth2_authorization_code');
    expect(res.body.platform.oauth_scopes).toContain('https://www.googleapis.com/auth/dfatrafficking');
  });

  it('includes capabilities with correct tool count', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.capabilities).toBeDefined();
    expect(res.body.capabilities.tool_count).toBe(70);
    expect(res.body.capabilities.write_safety.confirmation_required).toBe(true);
  });

  it('includes data processing commitments', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.data_processing.campaign_data_stored).toBe(false);
    expect(res.body.data_processing.training_data_usage).toBe('never');
    expect(res.body.data_processing.oauth_token_encryption).toBe('AES-256-GCM');
  });

  it('includes compliance declarations', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.compliance.eu_ai_act_article_50).toBe(true);
    expect(res.body.compliance.gdpr_aware).toBe(true);
    expect(res.body.compliance.ccpa_aware).toBe(true);
  });

  it('includes health check endpoints', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.health.liveness).toBe('/health/live');
    expect(res.body.health.readiness).toBe('/health/ready');
  });

  it('sets Cache-Control header for caching', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('max-age=3600');
  });

  it('includes security information', async () => {
    const res = await request(app).get('/api/v1/agent/manifest');

    expect(res.body.security).toBeDefined();
    expect(res.body.security.authentication).toContain('JWT');
    expect(res.body.security.input_validation).toContain('Zod');
    expect(res.body.security.rate_limiting).toBe(true);
  });
});

describe('GET /api/v1/agent/tools', () => {
  it('returns tool list without authentication', async () => {
    const res = await request(app).get('/api/v1/agent/tools');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.tool_count).toBe(70);
    expect(res.body.tools).toBeInstanceOf(Array);
    expect(res.body.tools).toHaveLength(70);
  });

  it('each tool has name and description', async () => {
    const res = await request(app).get('/api/v1/agent/tools');

    for (const tool of res.body.tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('includes known CM360 tools', async () => {
    const res = await request(app).get('/api/v1/agent/tools');
    const toolNames = res.body.tools.map((t: { name: string }) => t.name);

    expect(toolNames).toContain('cm360_list_campaigns');
    expect(toolNames).toContain('cm360_create_placement');
    expect(toolNames).toContain('cm360_generate_tags');
    expect(toolNames).toContain('cm360_pacing_analysis');
    expect(toolNames).toContain('cm360_list_floodlight_activities');
  });

  it('does not expose tool input schemas (minimal disclosure)', async () => {
    const res = await request(app).get('/api/v1/agent/tools');

    for (const tool of res.body.tools) {
      expect(tool.input_schema).toBeUndefined();
      expect(tool.parameters).toBeUndefined();
    }
  });

  it('sets Cache-Control header for caching', async () => {
    const res = await request(app).get('/api/v1/agent/tools');

    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('max-age=3600');
  });
});
