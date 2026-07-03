// ============================================================
// PipeField OS — Role-Based Permission System
//
// Think of this like keys on a keychain.
// Each role gets a set of keys (permissions).
// When a user tries to do something, we check if they have
// the right key before allowing the action.
// ============================================================
import type { UserRole, Permission } from '@/types'

// Map every role to the exact permissions it has.
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Platform admin — all permissions across all orgs
  platform_admin: [
    'organization:manage',
    'users:manage',
    'projects:create', 'projects:read', 'projects:update', 'projects:delete',
    'welds:create', 'welds:read', 'welds:update', 'welds:delete', 'welds:approve',
    'spools:create', 'spools:read', 'spools:update', 'spools:delete',
    'reports:generate', 'reports:read',
    'calculator:use', 'audit:read', 'settings:manage',
    'knowledge:query', 'knowledge:upload', 'knowledge:manage',
  ],

  // Organization owner — all org-level permissions
  organization_owner: [
    'organization:manage',
    'users:manage',
    'projects:create', 'projects:read', 'projects:update', 'projects:delete',
    'welds:create', 'welds:read', 'welds:update', 'welds:delete', 'welds:approve',
    'spools:create', 'spools:read', 'spools:update', 'spools:delete',
    'reports:generate', 'reports:read',
    'calculator:use', 'audit:read', 'settings:manage',
    'knowledge:query', 'knowledge:upload', 'knowledge:manage',
  ],

  administrator: [
    'organization:manage',
    'users:manage',
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',
    'welds:create',
    'welds:read',
    'welds:update',
    'welds:delete',
    'welds:approve',
    'spools:create',
    'spools:read',
    'spools:update',
    'spools:delete',
    'reports:generate',
    'reports:read',
    'calculator:use',
    'audit:read',
    'settings:manage',
    'knowledge:query', 'knowledge:upload', 'knowledge:manage',
  ],

  project_manager: [
    'projects:create',
    'projects:read',
    'projects:update',
    'welds:create',
    'welds:read',
    'welds:update',
    'welds:approve',
    'spools:create',
    'spools:read',
    'spools:update',
    'reports:generate',
    'reports:read',
    'calculator:use',
    'audit:read',
    'knowledge:query', 'knowledge:upload',
  ],

  foreman: [
    'projects:read',
    'welds:create',
    'welds:read',
    'welds:update',
    'welds:approve',
    'spools:read',
    'spools:update',
    'reports:read',
    'calculator:use',
    'knowledge:query', 'knowledge:upload',
  ],

  qa_inspector: [
    'projects:read',
    'welds:read',
    'welds:update',
    'welds:approve',
    'spools:read',
    'reports:generate',
    'reports:read',
    'audit:read',
    'knowledge:query', 'knowledge:upload',
  ],

  shop_fabricator: [
    'projects:read',
    'welds:create',
    'welds:read',
    'welds:update',
    'spools:read',
    'spools:update',
    'calculator:use',
    'knowledge:query',
  ],

  pipefitter: [
    'projects:read',
    'welds:create',
    'welds:read',
    'welds:update',
    'spools:read',
    'calculator:use',
    'knowledge:query',
  ],

  client_viewer: [
    'projects:read',
    'welds:read',
    'spools:read',
    'reports:read',
  ],
}

/**
 * Check if a role has a specific permission.
 *
 * Example:
 *   hasPermission('foreman', 'welds:create') → true
 *   hasPermission('client_viewer', 'welds:delete') → false
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Get all permissions for a given role.
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Check if a role has ALL of the listed permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}

/**
 * Check if a role has ANY of the listed permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

/**
 * Hierarchy-based check — useful for admin overrides.
 * Returns true if role is equal to or above the minimum required role.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  platform_admin:     200,
  organization_owner: 110,
  administrator:      100,
  project_manager:    80,
  foreman:            60,
  qa_inspector:       50,
  shop_fabricator:    40,
  pipefitter:         30,
  client_viewer:      10,
}

export function meetsMinimumRole(role: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole]
}

// ── Plan capability helpers ───────────────────────────────────
// Centralised source of truth for what each subscription tier can do.
// Use these checks in UI components and API routes instead of
// scattering tier-name strings throughout the codebase.

export interface PlanCapabilities {
  /** Can the org invite additional users? */
  canInviteUsers: boolean
  /** Can the org manage team-level org settings (roles, org profile)? */
  canManageOrganization: boolean
  /** Maximum number of active seats (null = unlimited). */
  seatLimit: number | null
}

export function getPlanCapabilities(tier: string): PlanCapabilities {
  switch (tier) {
    case 'field_pro':
      return { canInviteUsers: false, canManageOrganization: false, seatLimit: 1 }
    case 'free_trial':
      return { canInviteUsers: true,  canManageOrganization: true,  seatLimit: null }
    case 'starter':
      return { canInviteUsers: true,  canManageOrganization: true,  seatLimit: 3 }
    case 'professional':
      return { canInviteUsers: true,  canManageOrganization: true,  seatLimit: 15 }
    case 'enterprise':
      return { canInviteUsers: true,  canManageOrganization: true,  seatLimit: null }
    default:
      // Unknown tier — deny actions and treat as no seats available
      return { canInviteUsers: false, canManageOrganization: false, seatLimit: 0 }
  }
}
