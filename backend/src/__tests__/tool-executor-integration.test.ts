/**
 * Tests for real/mock routing logic in tool-executor.
 *
 * Verifies:
 * - No userId → always uses mock path
 * - userId + connected → uses real CM360 client
 * - userId + not connected → falls back to mock
 * - userId + token revoked → returns error to user
 * - Rate limit exceeded → returns rate limit error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getCM360Client and hasOAuthTokens
const mockGetCM360Client = vi.fn();
const mockHasOAuthTokens = vi.fn();

vi.mock('../cm360/token-manager.js', () => ({
  getCM360Client: (...args: unknown[]) => mockGetCM360Client(...args),
  hasOAuthTokens: (...args: unknown[]) => mockHasOAuthTokens(...args),
}));

// Mock CM360Client
const mockListProfiles = vi.fn();
const mockListAdvertisers = vi.fn();
const mockGetAdvertiser = vi.fn();
const mockListCampaigns = vi.fn();
const mockCreateCampaign = vi.fn();
const mockListSites = vi.fn();
const mockListLandingPages = vi.fn();
const mockCreateLandingPage = vi.fn();
const mockListPlacements = vi.fn();
const mockCreatePlacement = vi.fn();
const mockListCreatives = vi.fn();
const mockListAds = vi.fn();
const mockCreateAd = vi.fn();
const mockGenerateTags = vi.fn();

vi.mock('../cm360/cm360-client.js', () => ({
  CM360Client: vi.fn().mockImplementation(() => ({
    listProfiles: mockListProfiles,
    listAdvertisers: mockListAdvertisers,
    getAdvertiser: mockGetAdvertiser,
    listCampaigns: mockListCampaigns,
    createCampaign: mockCreateCampaign,
    listSites: mockListSites,
    listLandingPages: mockListLandingPages,
    createLandingPage: mockCreateLandingPage,
    listPlacements: mockListPlacements,
    createPlacement: mockCreatePlacement,
    listCreatives: mockListCreatives,
    listAds: mockListAds,
    createAd: mockCreateAd,
    generateTags: mockGenerateTags,
  })),
}));

// Mock rate limiter
const mockCheckRateLimit = vi.fn();
const mockRecordRequest = vi.fn();

vi.mock('../cm360/api-rate-limiter.js', () => ({
  checkCM360RateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordCM360Request: (...args: unknown[]) => mockRecordRequest(...args),
}));

import { executeTool } from '../cm360/tool-executor.js';
import { CM360NotConnectedError, CM360TokenRevokedError } from '../cm360/errors.js';

describe('Tool Executor — real/mock routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
  });

  it('should use mock path when no userId is provided', async () => {
    const result = await executeTool('cm360_list_profiles', {});
    expect(result.isError).toBe(false);
    expect(result.result).toHaveProperty('profiles');
    // getCM360Client should not have been called
    expect(mockGetCM360Client).not.toHaveBeenCalled();
  });

  it('should fall back to mock when CM360NotConnectedError is thrown', async () => {
    mockGetCM360Client.mockRejectedValue(new CM360NotConnectedError());

    const result = await executeTool('cm360_list_profiles', {}, 'user-123');
    expect(result.isError).toBe(false);
    expect(result.result).toHaveProperty('profiles');
    expect(mockGetCM360Client).toHaveBeenCalledWith('user-123');
  });

  it('should return error when CM360TokenRevokedError is thrown', async () => {
    mockGetCM360Client.mockRejectedValue(new CM360TokenRevokedError());

    const result = await executeTool('cm360_list_profiles', {}, 'user-123');
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('revoked');
  });

  it('should use real client when userId is provided and tokens exist', async () => {
    const mockApi = {};
    mockGetCM360Client.mockResolvedValue(mockApi);
    mockListProfiles.mockResolvedValue([
      { profileId: '123', accountId: '456', accountName: 'Test', userName: 'user', etag: 'x' },
    ]);

    const result = await executeTool('cm360_list_profiles', {}, 'user-123');
    expect(result.isError).toBe(false);
    expect(mockGetCM360Client).toHaveBeenCalledWith('user-123');
    expect(mockListProfiles).toHaveBeenCalled();
  });

  it('should return rate limit error when limit exceeded', async () => {
    const mockApi = {};
    mockGetCM360Client.mockResolvedValue(mockApi);
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 5000 });

    const result = await executeTool('cm360_list_profiles', {}, 'user-123');
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('rate limit');
  });

  it('should use real client for list_advertisers with userId', async () => {
    const mockApi = {};
    mockGetCM360Client.mockResolvedValue(mockApi);
    mockListProfiles.mockResolvedValue([
      { profileId: '123', accountId: '456', accountName: 'Test', userName: 'user', etag: 'x' },
    ]);
    mockListAdvertisers.mockResolvedValue([
      { id: '1', name: 'Test Advertiser', accountId: '456', status: 'APPROVED' },
    ]);

    const result = await executeTool('cm360_list_advertisers', { profileId: '123' }, 'user-123');
    expect(result.isError).toBe(false);
    expect(mockListAdvertisers).toHaveBeenCalled();
  });

  it('should handle unknown tools', async () => {
    const result = await executeTool('unknown_tool', {}, 'user-123');
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('Unknown tool');
  });
});
