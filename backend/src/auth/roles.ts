/**
 * Role-based access control (RBAC) for AdTraffic.ai
 *
 * Three roles with distinct permission profiles:
 * - admin: Full system access, user management, all write operations
 * - senior: Write operations + approval authority, no user management
 * - junior: Read-only by default, write operations require approval
 */

import type { Request, Response, NextFunction } from 'express';

export type UserRole = 'admin' | 'senior' | 'junior';

export interface RolePermissions {
  canExecuteWriteTools: boolean;
  canApproveOthers: boolean;
  canManageUsers: boolean;
  canViewAuditLogs: boolean;
  requiresApproval: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canExecuteWriteTools: true,
    canApproveOthers: true,
    canManageUsers: true,
    canViewAuditLogs: true,
    requiresApproval: false,
  },
  senior: {
    canExecuteWriteTools: true,
    canApproveOthers: true,
    canManageUsers: false,
    canViewAuditLogs: true,
    requiresApproval: false,
  },
  junior: {
    canExecuteWriteTools: false,
    canApproveOthers: false,
    canManageUsers: false,
    canViewAuditLogs: false,
    requiresApproval: true,
  },
};

/** Helper: check if a role has a specific permission */
export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/** Helper: validate that a string is a valid UserRole (derived from ROLE_PERMISSIONS registry) */
export function isValidRole(role: string): role is UserRole {
  return role in ROLE_PERMISSIONS;
}

/**
 * Express middleware: require that the authenticated user has a specific permission.
 * Must be used AFTER requireAuth middleware (req.user must be set).
 * Returns 403 if the user's role lacks the required permission.
 */
export function requirePermission(permission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !isValidRole(role)) {
      res.status(403).json({ error: 'Forbidden: no valid role assigned' });
      return;
    }
    if (!hasPermission(role, permission)) {
      res.status(403).json({ error: `Forbidden: requires ${permission} permission` });
      return;
    }
    next();
  };
}
