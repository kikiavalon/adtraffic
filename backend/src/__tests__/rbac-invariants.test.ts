import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../auth/roles.js';

describe('RBAC segregation-of-duties invariant', () => {
  it('no role both requires approval and can approve others', () => {
    // A role holding both bits could submit its own write to the approval queue
    // and immediately approve it, collapsing the four-eyes control. The route
    // layer also enforces requester !== approver, but this keeps the role table
    // itself from encoding a self-approval capability.
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      expect(perms.requiresApproval && perms.canApproveOthers, `role ${role}`).toBe(false);
    }
  });
});
