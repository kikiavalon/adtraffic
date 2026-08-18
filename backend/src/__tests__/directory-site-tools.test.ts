import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// cm360_list_directory_sites
// ---------------------------------------------------------------------------

describe('cm360_list_directory_sites', () => {
  it('lists all directory sites', async () => {
    const result = await executeTool('cm360_list_directory_sites', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { directorySites: unknown[] };
    expect(data.directorySites.length).toBe(15);
  });

  it('filters directory sites by search string', async () => {
    const result = await executeTool('cm360_list_directory_sites', {
      profileId: PROFILE_ID,
      searchString: 'Wired',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { directorySites: Array<{ name: string }> };
    expect(data.directorySites.length).toBe(1);
    expect(data.directorySites[0]!.name).toBe('Wired');
  });

  it('returns empty array when no match', async () => {
    const result = await executeTool('cm360_list_directory_sites', {
      profileId: PROFILE_ID,
      searchString: 'nonexistent-publisher',
    });
    expect(result.isError).toBe(false);
    const data = result.result as { directorySites: unknown[] };
    expect(data.directorySites.length).toBe(0);
  });

  it('rejects missing profileId', async () => {
    const result = await executeTool('cm360_list_directory_sites', {});
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_get_directory_site
// ---------------------------------------------------------------------------

describe('cm360_get_directory_site', () => {
  it('returns a directory site by ID', async () => {
    // First list to get a valid ID
    const listResult = await executeTool('cm360_list_directory_sites', {
      profileId: PROFILE_ID,
    });
    const data = listResult.result as { directorySites: Array<{ id: string; name: string; url: string }> };
    const first = data.directorySites[0]!;

    const result = await executeTool('cm360_get_directory_site', {
      profileId: PROFILE_ID,
      directorySiteId: first.id,
    });
    expect(result.isError).toBe(false);
    const site = result.result as { id: string; name: string; url: string; active: boolean; inpageTagFormats: string[] };
    expect(site.id).toBe(first.id);
    expect(site.name).toBe(first.name);
    expect(site.url).toBe(first.url);
    expect(site.active).toBe(true);
    expect(site.inpageTagFormats.length).toBeGreaterThan(0);
  });

  it('returns error for nonexistent directory site', async () => {
    const result = await executeTool('cm360_get_directory_site', {
      profileId: PROFILE_ID,
      directorySiteId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects missing directorySiteId', async () => {
    const result = await executeTool('cm360_get_directory_site', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_insert_directory_site
// ---------------------------------------------------------------------------

describe('cm360_insert_directory_site', () => {
  it('inserts a directory site, returning the DirectorySite entry (not a Site)', async () => {
    // Get a directory site ID
    const listResult = await executeTool('cm360_list_directory_sites', {
      profileId: PROFILE_ID,
    });
    const data = listResult.result as { directorySites: Array<{ id: string; name: string }> };
    const dirSite = data.directorySites[0]!;

    // CM360 directorySites.insert does not approve or create a Site — it returns
    // the DirectorySite entry. So the account's site catalog is unchanged.
    const sitesBefore = mockStore.listSites();
    const countBefore = sitesBefore.length;

    // Insert it
    const result = await executeTool('cm360_insert_directory_site', {
      profileId: PROFILE_ID,
      siteId: dirSite.id,
    });
    expect(result.isError).toBe(false);
    const resultData = result.result as {
      id: string; name: string; url: string; active: boolean;
      interstitialTagFormats: string[]; inpageTagFormats: string[];
    };
    // Same shape as the live path: an inline DirectorySite, no false "approved" flag.
    expect(resultData.id).toBe(dirSite.id);
    expect(resultData.name).toBe(dirSite.name);
    expect(resultData).not.toHaveProperty('approved');
    expect(Array.isArray(resultData.interstitialTagFormats)).toBe(true);
    expect(Array.isArray(resultData.inpageTagFormats)).toBe(true);

    // No new Site was created
    const sitesAfter = mockStore.listSites();
    expect(sitesAfter.length).toBe(countBefore);
  });

  it('is idempotent — inserting the same directory site twice returns the same entry', async () => {
    const listResult = await executeTool('cm360_list_directory_sites', {
      profileId: PROFILE_ID,
    });
    const data = listResult.result as { directorySites: Array<{ id: string }> };
    const dirSiteId = data.directorySites[0]!.id;

    // Insert twice
    const result1 = await executeTool('cm360_insert_directory_site', {
      profileId: PROFILE_ID,
      siteId: dirSiteId,
    });
    const result2 = await executeTool('cm360_insert_directory_site', {
      profileId: PROFILE_ID,
      siteId: dirSiteId,
    });

    const site1 = result1.result as { id: string };
    const site2 = result2.result as { id: string };
    expect(site1.id).toBe(site2.id); // Same entry returned
    expect(site1.id).toBe(dirSiteId);
  });

  it('rejects nonexistent directory site ID', async () => {
    const result = await executeTool('cm360_insert_directory_site', {
      profileId: PROFILE_ID,
      siteId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });

  it('rejects missing siteId', async () => {
    const result = await executeTool('cm360_insert_directory_site', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Directory site seed data validation
// ---------------------------------------------------------------------------

describe('Directory site seed data', () => {
  it('seeds 15 directory sites', () => {
    const sites = mockStore.listDirectorySites();
    expect(sites.length).toBe(15);
  });

  it('includes expected publisher names', () => {
    const sites = mockStore.listDirectorySites();
    const names = sites.map((s: { name: string }) => s.name);
    expect(names).toContain('BuzzFeed');
    expect(names).toContain('Wired');
    expect(names).toContain('The Guardian');
    expect(names).toContain('Ars Technica');
    expect(names).toContain('Gizmodo');
  });

  it('all directory sites have valid tag formats', () => {
    const sites = mockStore.listDirectorySites();
    for (const site of sites) {
      const s = site as { inpageTagFormats: string[]; interstitialTagFormats: string[] };
      expect(s.inpageTagFormats.length).toBeGreaterThan(0);
      expect(s.interstitialTagFormats.length).toBeGreaterThan(0);
    }
  });

  it('all directory sites have URLs starting with https://', () => {
    const sites = mockStore.listDirectorySites();
    for (const site of sites) {
      expect((site as { url: string }).url).toMatch(/^https:\/\//);
    }
  });
});
