import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool } from '../cm360/tool-executor.js';
import { mockStore } from '../cm360/mock-data-store.js';

const PROFILE_ID = '12345';

beforeEach(() => {
  mockStore.reset();
});

// ---------------------------------------------------------------------------
// Seed data validation
// ---------------------------------------------------------------------------

describe('User & Role seed data', () => {
  it('seeds 8 user profiles', () => {
    const profiles = mockStore.listAccountUserProfiles();
    expect(profiles.length).toBe(8);
  });

  it('seeds 7 user roles (5 default + 2 custom)', () => {
    const roles = mockStore.listUserRoles();
    expect(roles.length).toBe(7);
    const defaults = roles.filter(r => r.defaultUserRole);
    expect(defaults.length).toBe(5);
  });

  it('seeds 42 permissions across 15 groups', () => {
    const permissions = mockStore.listUserRolePermissions();
    expect(permissions.length).toBe(42);
    const groups = mockStore.listUserRolePermissionGroups();
    expect(groups.length).toBe(15);
  });

  it('seeds 2 subaccounts', () => {
    const subs = mockStore.listSubaccounts();
    expect(subs.length).toBe(2);
  });

  it('has expected default role names', () => {
    const roles = mockStore.listUserRoles();
    const names = roles.map(r => r.name);
    expect(names).toContain('Agency Admin');
    expect(names).toContain('Agency Trafficker');
    expect(names).toContain('Site Trafficker');
  });

  it('has expected subaccount names', () => {
    const subs = mockStore.listSubaccounts();
    const names = subs.map(s => s.name);
    expect(names).toContain('Internal Operations');
    expect(names).toContain('Publisher Partners');
  });
});

// ---------------------------------------------------------------------------
// cm360_list_account_user_profiles
// ---------------------------------------------------------------------------

describe('cm360_list_account_user_profiles', () => {
  it('lists all user profiles', async () => {
    const result = await executeTool('cm360_list_account_user_profiles', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { accountUserProfiles: unknown[]; totalResults: number };
    expect(data.accountUserProfiles.length).toBe(8);
    expect(data.totalResults).toBe(8);
  });

  it('filters by active status', async () => {
    const result = await executeTool('cm360_list_account_user_profiles', {
      profileId: PROFILE_ID,
      active: false,
    });
    const data = result.result as { accountUserProfiles: Array<{ active: boolean }> };
    expect(data.accountUserProfiles.length).toBe(1);
    expect(data.accountUserProfiles[0]!.active).toBe(false);
  });

  it('filters by search string', async () => {
    const result = await executeTool('cm360_list_account_user_profiles', {
      profileId: PROFILE_ID,
      searchString: 'forbes',
    });
    const data = result.result as { accountUserProfiles: Array<{ email: string }> };
    expect(data.accountUserProfiles.length).toBe(1);
    expect(data.accountUserProfiles[0]!.email).toContain('forbes');
  });

  it('rejects missing profileId', async () => {
    const result = await executeTool('cm360_list_account_user_profiles', {});
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_get_account_user_profile
// ---------------------------------------------------------------------------

describe('cm360_get_account_user_profile', () => {
  it('returns a user profile by ID', async () => {
    const list = mockStore.listAccountUserProfiles();
    const first = list[0]!;
    const result = await executeTool('cm360_get_account_user_profile', {
      profileId: PROFILE_ID,
      accountUserProfileId: first.id,
    });
    expect(result.isError).toBe(false);
    const user = result.result as { id: string; email: string; siteFilter: { status: string } };
    expect(user.id).toBe(first.id);
    expect(user.email).toBe(first.email);
    expect(user.siteFilter).toBeDefined();
  });

  it('returns error for nonexistent profile', async () => {
    const result = await executeTool('cm360_get_account_user_profile', {
      profileId: PROFILE_ID,
      accountUserProfileId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// cm360_create_account_user_profile
// ---------------------------------------------------------------------------

describe('cm360_create_account_user_profile', () => {
  it('creates a new user profile', async () => {
    const roles = mockStore.listUserRoles();
    const role = roles.find(r => r.name === 'Agency Trafficker')!;
    const result = await executeTool('cm360_create_account_user_profile', {
      profileId: PROFILE_ID,
      email: 'newuser@agency.com',
      name: 'NewUser',
      userRoleId: role.id,
    });
    expect(result.isError).toBe(false);
    const user = result.result as { id: string; email: string; active: boolean; userRoleName: string };
    expect(user.email).toBe('newuser@agency.com');
    expect(user.active).toBe(true);
    expect(user.userRoleName).toBe('Agency Trafficker');
  });

  it('creates user with custom access filters', async () => {
    const roles = mockStore.listUserRoles();
    const siteTrafficker = roles.find(r => r.name === 'Site Trafficker')!;
    const sites = mockStore.listSites();
    const result = await executeTool('cm360_create_account_user_profile', {
      profileId: PROFILE_ID,
      email: 'publisher@example.com',
      name: 'PublisherRep',
      userRoleId: siteTrafficker.id,
      siteFilter: { status: 'ASSIGNED', objectIds: [sites[0]!.id] },
      campaignFilter: { status: 'NONE' },
    });
    expect(result.isError).toBe(false);
    const user = result.result as { siteFilter: { status: string; objectIds: string[] }; campaignFilter: { status: string } };
    expect(user.siteFilter.status).toBe('ASSIGNED');
    expect(user.siteFilter.objectIds).toContain(sites[0]!.id);
    expect(user.campaignFilter.status).toBe('NONE');
  });

  it('rejects invalid email', async () => {
    const result = await executeTool('cm360_create_account_user_profile', {
      profileId: PROFILE_ID,
      email: 'not-an-email',
      name: 'Test',
      userRoleId: 'some-role',
    });
    expect(result.isError).toBe(true);
  });

  it('rejects invalid name with special characters', async () => {
    const result = await executeTool('cm360_create_account_user_profile', {
      profileId: PROFILE_ID,
      email: 'test@test.com',
      name: 'Bad Name <script>',
      userRoleId: 'some-role',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_list_user_roles
// ---------------------------------------------------------------------------

describe('cm360_list_user_roles', () => {
  it('lists all roles', async () => {
    const result = await executeTool('cm360_list_user_roles', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { userRoles: unknown[]; totalResults: number };
    expect(data.userRoles.length).toBe(7);
  });

  it('filters by search string', async () => {
    const result = await executeTool('cm360_list_user_roles', {
      profileId: PROFILE_ID,
      searchString: 'Admin',
    });
    const data = result.result as { userRoles: Array<{ name: string }> };
    expect(data.userRoles.length).toBeGreaterThan(0);
    for (const role of data.userRoles) {
      expect(role.name.toLowerCase()).toContain('admin');
    }
  });
});

// ---------------------------------------------------------------------------
// cm360_get_user_role
// ---------------------------------------------------------------------------

describe('cm360_get_user_role', () => {
  it('returns role details with permissions', async () => {
    const roles = mockStore.listUserRoles();
    const admin = roles.find(r => r.name === 'Agency Admin')!;
    const result = await executeTool('cm360_get_user_role', {
      profileId: PROFILE_ID,
      userRoleId: admin.id,
    });
    expect(result.isError).toBe(false);
    const role = result.result as { id: string; name: string; defaultUserRole: boolean; permissionIds: string[] };
    expect(role.name).toBe('Agency Admin');
    expect(role.defaultUserRole).toBe(true);
    expect(role.permissionIds.length).toBeGreaterThan(0);
  });

  it('returns error for nonexistent role', async () => {
    const result = await executeTool('cm360_get_user_role', {
      profileId: PROFILE_ID,
      userRoleId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// cm360_create_user_role
// ---------------------------------------------------------------------------

describe('cm360_create_user_role', () => {
  it('creates a custom role with parent', async () => {
    const roles = mockStore.listUserRoles();
    const siteTrafficker = roles.find(r => r.name === 'Site Trafficker')!;
    const permissions = mockStore.listUserRolePermissions();
    const viewPerm = permissions.find(p => p.name === 'View placements')!;

    const result = await executeTool('cm360_create_user_role', {
      profileId: PROFILE_ID,
      name: 'Custom Publisher Role',
      parentUserRoleId: siteTrafficker.id,
      permissionIds: [viewPerm.id],
    });
    expect(result.isError).toBe(false);
    const role = result.result as { id: string; name: string; defaultUserRole: boolean; parentUserRoleName: string };
    expect(role.name).toBe('Custom Publisher Role');
    expect(role.defaultUserRole).toBe(false);
    expect(role.parentUserRoleName).toBe('Site Trafficker');
  });

  it('returns error for nonexistent parent role', async () => {
    const result = await executeTool('cm360_create_user_role', {
      profileId: PROFILE_ID,
      name: 'Orphan Role',
      parentUserRoleId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// cm360_list_user_role_permissions / cm360_get_user_role_permission
// ---------------------------------------------------------------------------

describe('cm360_list_user_role_permissions', () => {
  it('lists all permissions', async () => {
    const result = await executeTool('cm360_list_user_role_permissions', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { userRolePermissions: Array<{ id: string; name: string; permissionGroupId: string }> };
    expect(data.userRolePermissions.length).toBe(42);
    // All have required fields
    for (const perm of data.userRolePermissions) {
      expect(perm.id).toBeDefined();
      expect(perm.name).toBeDefined();
      expect(perm.permissionGroupId).toBeDefined();
    }
  });
});

describe('cm360_get_user_role_permission', () => {
  it('returns permission by ID', async () => {
    const result = await executeTool('cm360_get_user_role_permission', {
      profileId: PROFILE_ID,
      permissionId: 'perm-1',
    });
    expect(result.isError).toBe(false);
    const perm = result.result as { id: string; name: string };
    expect(perm.id).toBe('perm-1');
    expect(perm.name).toBe('View campaigns');
  });

  it('returns error for nonexistent permission', async () => {
    const result = await executeTool('cm360_get_user_role_permission', {
      profileId: PROFILE_ID,
      permissionId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_list_user_role_permission_groups / cm360_get_user_role_permission_group
// ---------------------------------------------------------------------------

describe('cm360_list_user_role_permission_groups', () => {
  it('lists all permission groups', async () => {
    const result = await executeTool('cm360_list_user_role_permission_groups', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { userRolePermissionGroups: Array<{ id: string; name: string }> };
    expect(data.userRolePermissionGroups.length).toBe(15);
    const names = data.userRolePermissionGroups.map(g => g.name);
    expect(names).toContain('Campaigns');
    expect(names).toContain('Floodlight');
    expect(names).toContain('Reporting');
  });
});

describe('cm360_get_user_role_permission_group', () => {
  it('returns permission group by ID', async () => {
    const result = await executeTool('cm360_get_user_role_permission_group', {
      profileId: PROFILE_ID,
      permissionGroupId: 'pg-1',
    });
    expect(result.isError).toBe(false);
    const group = result.result as { id: string; name: string };
    expect(group.id).toBe('pg-1');
    expect(group.name).toBe('Campaigns');
  });

  it('returns error for nonexistent group', async () => {
    const result = await executeTool('cm360_get_user_role_permission_group', {
      profileId: PROFILE_ID,
      permissionGroupId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cm360_list_subaccounts / cm360_get_subaccount
// ---------------------------------------------------------------------------

describe('cm360_list_subaccounts', () => {
  it('lists all subaccounts', async () => {
    const result = await executeTool('cm360_list_subaccounts', {
      profileId: PROFILE_ID,
    });
    expect(result.isError).toBe(false);
    const data = result.result as { subaccounts: Array<{ name: string }>; totalResults: number };
    expect(data.subaccounts.length).toBe(2);
  });

  it('filters by search string', async () => {
    const result = await executeTool('cm360_list_subaccounts', {
      profileId: PROFILE_ID,
      searchString: 'Publisher',
    });
    const data = result.result as { subaccounts: Array<{ name: string }> };
    expect(data.subaccounts.length).toBe(1);
    expect(data.subaccounts[0]!.name).toContain('Publisher');
  });
});

describe('cm360_get_subaccount', () => {
  it('returns subaccount by ID', async () => {
    const subs = mockStore.listSubaccounts();
    const first = subs[0]!;
    const result = await executeTool('cm360_get_subaccount', {
      profileId: PROFILE_ID,
      subaccountId: first.id,
    });
    expect(result.isError).toBe(false);
    const sub = result.result as { id: string; name: string; availablePermissionIds: string[] };
    expect(sub.id).toBe(first.id);
    expect(sub.name).toBe(first.name);
    expect(sub.availablePermissionIds.length).toBeGreaterThan(0);
  });

  it('returns error for nonexistent subaccount', async () => {
    const result = await executeTool('cm360_get_subaccount', {
      profileId: PROFILE_ID,
      subaccountId: 'nonexistent',
    });
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain('not found');
  });
});
