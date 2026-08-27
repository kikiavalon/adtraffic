import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CM360_TOOLS, mockStore } from '@adtraffic/shared/mock-cm360';
import { createAdTrafficServer } from '../server.js';

// The single source of truth for the package version is the same package.json
// that npm publishes. The server's advertised version MUST track it.
const pkgVersion = (
  JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'),
  ) as { version: string }
).version;

const openClients: Client[] = [];
let savedDemoMode: string | undefined;

beforeEach(() => {
  mockStore.reset();
  savedDemoMode = process.env.DEMO_MODE;
});

async function connectedClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createAdTrafficServer();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  openClients.push(client);
  return client;
}

afterEach(async () => {
  // Closing the client closes the linked in-memory pair (client + server transports).
  await Promise.all(openClients.splice(0).map((client) => client.close()));
  // Restore DEMO_MODE — the clickTag regression test deletes it; keep it from leaking.
  if (savedDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = savedDemoMode;
});

describe('createAdTrafficServer', () => {
  it('lists all CM360 tools with schemas intact', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(CM360_TOOLS.length);

    const source = CM360_TOOLS.find((t) => t.name === 'cm360_list_profiles');
    expect(source).toBeDefined();
    const listProfiles = tools.find((t) => t.name === 'cm360_list_profiles');
    expect(listProfiles).toBeDefined();
    expect(listProfiles?.description).toBe(source?.description);
    expect(listProfiles?.inputSchema).toMatchObject({ type: 'object' });
    expect(listProfiles?.inputSchema).toEqual(source?.input_schema);
  });

  it('advertises the version from package.json in its MCP handshake (no drift)', async () => {
    const client = await connectedClient();
    const impl = client.getServerVersion();
    expect(impl?.name).toBe('adtraffic-mcp');
    // Guards against the server version being a hardcoded literal that silently
    // drifts from package.json (as it did before 0.1.1, which shipped announcing 0.1.0).
    expect(impl?.version).toBe(pkgVersion);
  });

  it('executes cm360_list_profiles and returns profiles as JSON text', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'cm360_list_profiles', arguments: {} });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe('text');
    const parsed = JSON.parse(content[0].text) as { profiles: unknown[] };
    expect(Array.isArray(parsed.profiles)).toBe(true);
    expect(parsed.profiles.length).toBeGreaterThan(0);
  });

  it('persists a created campaign so a subsequent list shows it (read-your-writes)', async () => {
    const client = await connectedClient();
    const callJson = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      return JSON.parse(content[0].text) as T;
    };

    // Discover real seeded IDs through the MCP client.
    const { profiles } = await callJson<{ profiles: Array<{ profileId: string }> }>(
      'cm360_list_profiles',
      {},
    );
    expect(profiles.length).toBeGreaterThan(0);
    const profileId = profiles[0].profileId;
    const { advertisers } = await callJson<{ advertisers: Array<{ id: string }> }>(
      'cm360_list_advertisers',
      { profileId },
    );
    expect(advertisers.length).toBeGreaterThan(0);
    const advertiserId = advertisers[0].id;
    const { landingPages } = await callJson<{ landingPages: Array<{ id: string }> }>(
      'cm360_list_landing_pages',
      { profileId, advertiserId },
    );
    expect(landingPages.length).toBeGreaterThan(0);
    const defaultLandingPageId = landingPages[0].id;

    const campaignName = 'MCP Task6 Test Campaign';
    const created = await callJson<{ id: string; name: string }>('cm360_create_campaign', {
      profileId,
      advertiserId,
      name: campaignName,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      defaultLandingPageId,
    });
    expect(created.name).toBe(campaignName);

    const { campaigns } = await callJson<{ campaigns: Array<{ id: string; name: string }> }>(
      'cm360_list_campaigns',
      { profileId, advertiserId, searchString: campaignName },
    );
    const found = campaigns.find((c) => c.id === created.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe(campaignName);
  });

  it('returns isError with an invalid-input message for bad tool input', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'cm360_get_advertiser', arguments: {} });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('Invalid input');
    // Error payloads are flat: { error: string, details?: string }
    const parsed = JSON.parse(content[0].text) as { error: string; details?: string };
    expect(parsed.error).toBe('Invalid input');
    expect(typeof parsed.details).toBe('string');
  });

  it('leaves clickTags at the real ad.doubleclick.net domain (DEMO_MODE unset)', async () => {
    // The MCP process never sets DEMO_MODE — generated clickTags must point at
    // the real ad-serving domain, not the local demo fixture path.
    delete process.env.DEMO_MODE;
    const client = await connectedClient();
    const callJson = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      return JSON.parse(content[0].text) as T;
    };

    // Discover real seeded IDs through the MCP client.
    const { profiles } = await callJson<{ profiles: Array<{ profileId: string }> }>(
      'cm360_list_profiles',
      {},
    );
    const profileId = profiles[0].profileId;
    const { advertisers } = await callJson<{ advertisers: Array<{ id: string }> }>(
      'cm360_list_advertisers',
      { profileId },
    );
    const advertiserId = advertisers[0].id;
    const { campaigns } = await callJson<{ campaigns: Array<{ id: string }> }>(
      'cm360_list_campaigns',
      { profileId, advertiserId },
    );
    expect(campaigns.length).toBeGreaterThan(0);
    const campaignId = campaigns[0].id;
    const { placements } = await callJson<{ placements: Array<{ id: string }> }>(
      'cm360_list_placements',
      { profileId, campaignId },
    );
    expect(placements.length).toBeGreaterThan(0);
    const placementId = placements[0].id;

    const { placementTags } = await callJson<{
      placementTags: Array<{ placementId: string; tagData: Array<{ clickTag: string }> }>;
    }>('cm360_generate_tags', { profileId, campaignId, placementIds: [placementId] });

    expect(placementTags.length).toBeGreaterThan(0);
    const clickTags = placementTags.flatMap((t) => t.tagData.map((td) => td.clickTag));
    expect(clickTags.length).toBeGreaterThan(0);
    for (const clickTag of clickTags) {
      expect(clickTag).toContain('ad.doubleclick.net/ddm/trackclk');
      expect(clickTag).not.toContain('/demo/click/');
    }
  });

  it('returns isError for an unknown tool name', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'cm360_nonexistent_tool', arguments: {} });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain('Unknown tool: cm360_nonexistent_tool');
  });
});
