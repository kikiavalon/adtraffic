/**
 * Tests for the role-based access control (RBAC) system.
 *
 * Covers:
 * - ROLE_PERMISSIONS registry for admin/senior/junior
 * - hasPermission() helper
 * - isValidRole() helper
 * - requirePermission() middleware
 * - Schema default role value
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  ROLE_PERMISSIONS,
  hasPermission,
  isValidRole,
  requirePermission,
  type UserRole,
  type RolePermissions,
} from '../auth/roles.js';
import { users } from '../db/schema.js';

describe('Role-based access control', () => {
  describe('ROLE_PERMISSIONS registry', () => {
    it('defines permissions for all three roles', () => {
      expect(ROLE_PERMISSIONS).toHaveProperty('admin');
      expect(ROLE_PERMISSIONS).toHaveProperty('senior');
      expect(ROLE_PERMISSIONS).toHaveProperty('junior');
      expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(3);
    });

    it('admin has all permissions enabled and does not require approval', () => {
      const admin = ROLE_PERMISSIONS.admin;
      expect(admin.canExecuteWriteTools).toBe(true);
      expect(admin.canApproveOthers).toBe(true);
      expect(admin.canManageUsers).toBe(true);
      expect(admin.canViewAuditLogs).toBe(true);
      expect(admin.requiresApproval).toBe(false);
    });

    it('senior can write and approve but cannot manage users', () => {
      const senior = ROLE_PERMISSIONS.senior;
      expect(senior.canExecuteWriteTools).toBe(true);
      expect(senior.canApproveOthers).toBe(true);
      expect(senior.canManageUsers).toBe(false);
      expect(senior.canViewAuditLogs).toBe(true);
      expect(senior.requiresApproval).toBe(false);
    });

    it('junior cannot write, cannot approve, and requires approval', () => {
      const junior = ROLE_PERMISSIONS.junior;
      expect(junior.canExecuteWriteTools).toBe(false);
      expect(junior.canApproveOthers).toBe(false);
      expect(junior.canManageUsers).toBe(false);
      expect(junior.canViewAuditLogs).toBe(false);
      expect(junior.requiresApproval).toBe(true);
    });

    it('every role has all five permission keys', () => {
      const expectedKeys: (keyof RolePermissions)[] = [
        'canExecuteWriteTools',
        'canApproveOthers',
        'canManageUsers',
        'canViewAuditLogs',
        'requiresApproval',
      ];
      for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
        for (const key of expectedKeys) {
          expect(ROLE_PERMISSIONS[role]).toHaveProperty(key);
          expect(typeof ROLE_PERMISSIONS[role][key]).toBe('boolean');
        }
      }
    });
  });

  describe('hasPermission()', () => {
    it('returns true for admin canManageUsers', () => {
      expect(hasPermission('admin', 'canManageUsers')).toBe(true);
    });

    it('returns false for senior canManageUsers', () => {
      expect(hasPermission('senior', 'canManageUsers')).toBe(false);
    });

    it('returns false for junior canExecuteWriteTools', () => {
      expect(hasPermission('junior', 'canExecuteWriteTools')).toBe(false);
    });

    it('returns true for junior requiresApproval', () => {
      expect(hasPermission('junior', 'requiresApproval')).toBe(true);
    });

    it('returns true for senior canViewAuditLogs', () => {
      expect(hasPermission('senior', 'canViewAuditLogs')).toBe(true);
    });

    it('returns false for junior canViewAuditLogs', () => {
      expect(hasPermission('junior', 'canViewAuditLogs')).toBe(false);
    });
  });

  describe('isValidRole()', () => {
    it('returns true for "admin"', () => {
      expect(isValidRole('admin')).toBe(true);
    });

    it('returns true for "senior"', () => {
      expect(isValidRole('senior')).toBe(true);
    });

    it('returns true for "junior"', () => {
      expect(isValidRole('junior')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isValidRole('')).toBe(false);
    });

    it('returns false for "superadmin"', () => {
      expect(isValidRole('superadmin')).toBe(false);
    });

    it('returns false for "Admin" (case-sensitive)', () => {
      expect(isValidRole('Admin')).toBe(false);
    });

    it('returns false for "SENIOR" (case-sensitive)', () => {
      expect(isValidRole('SENIOR')).toBe(false);
    });

    it('returns false for arbitrary string', () => {
      expect(isValidRole('viewer')).toBe(false);
    });
  });

  describe('requirePermission() middleware', () => {
    function mockReqRes(role?: string) {
      const req = { user: role !== undefined ? { userId: 'u1', email: 'a@b.com', role } : undefined } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;
      return { req, res, next };
    }

    it('calls next when user has the required permission', () => {
      const { req, res, next } = mockReqRes('admin');
      requirePermission('canManageUsers')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 when user lacks the required permission', () => {
      const { req, res, next } = mockReqRes('junior');
      requirePermission('canExecuteWriteTools')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: requires canExecuteWriteTools permission' });
    });

    it('returns 403 when no user on request', () => {
      const req = {} as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn() as NextFunction;
      requirePermission('canManageUsers')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 when role is invalid string', () => {
      const { req, res, next } = mockReqRes('bogus');
      requirePermission('canManageUsers')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('senior can approve others', () => {
      const { req, res, next } = mockReqRes('senior');
      requirePermission('canApproveOthers')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('junior cannot approve others', () => {
      const { req, res, next } = mockReqRes('junior');
      requirePermission('canApproveOthers')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Schema default role', () => {
    it('users table role column defaults to "junior" (least privilege)', () => {
      const roleColumn = users.role;
      expect(roleColumn.default).toBe('junior');
    });
  });
});
