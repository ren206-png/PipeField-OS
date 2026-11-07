// ============================================================
// API Route Auth Helpers
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveBilling } from '@/lib/api-billing-guard'
import { hasPermission } from '@/lib/auth/permissions'
import type { Permission, UserRole } from '@/types'

// ── Billing lockout on writes ────────────────────────────────
// A locked org (payment failed past grace, or trial ended without a plan)
// keeps read access but cannot write. These paths stay open so a locked
// org can still sign in, see itself, fix billing and contact support.
const BILLING_EXEMPT_PREFIXES = [
  '/api/billing',
  '/api/auth',
  '/api/me',
  '/api/register',
  '/api/contact',
  '/api/feedback',
  '/api/errors',
  '/api/notifications',
  '/api/cron',
  '/api/admin',
]
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** True when this request must pass the billing lockout check. */
export function needsBillingCheck(method: string, path: string, role: string | null | undefined): boolean {
  if (READ_METHODS.has(method.toUpperCase())) return false
  if (role === 'platform_admin') return false
  return !BILLING_EXEMPT_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
}

async function billingLockout(req: NextRequest | undefined, caller: CallerProfile): Promise<NextResponse | null> {
  if (!req) return null
  if (!needsBillingCheck(req.method, req.nextUrl?.pathname ?? '', caller.role)) return null
  return requireActiveBilling(caller.organization_id)
}

// ── Role sets ─────────────────────────────────────────────────
export const ORG_ADMIN_ROLES = [
  'platform_admin',
  'organization_owner',
  'administrator',
] as const

export type OrgAdminRole = (typeof ORG_ADMIN_ROLES)[number]

// ── Caller profile shape ──────────────────────────────────────
export interface CallerProfile {
  id:              string
  auth_user_id:    string
  role:            string
  organization_id: string | null
  full_name:       string | null
  status:          string | null
}

// ── Core helper ───────────────────────────────────────────────
export async function getCallerProfile(req?: NextRequest): Promise<CallerProfile | null> {
  const admin = createAdminClient()
  let userId: string | null = null

  // ── Strategy 1: Bearer token from Authorization header ──────
  // The frontend injects this via apiFetch(). Works even when
  // the SSR cookie is stale or missing after token expiry.
  const authHeader = req
    ? (req.headers.get('authorization') ?? '')
    : ''

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (!error && user) userId = user.id
  }

  // ── Strategy 2: Session cookie (standard SSR flow) ──────────
  if (!userId) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* Server Components can't set cookies */ }
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  }

  if (!userId) return null

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, auth_user_id, role, organization_id, full_name, status')
    .eq('auth_user_id', userId)
    .maybeSingle()

  return profile ?? null
}

// ── Guard helpers ─────────────────────────────────────────────
export async function requireAuth(req?: NextRequest): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile(req)
  if (!caller) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  // Reject suspended or inactive accounts
  if (caller.status && caller.status !== 'active') {
    return { error: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }
  }
  const locked = await billingLockout(req, caller)
  if (locked) return { error: locked }
  return { caller }
}

/**
 * requireAuth + role check against the permission matrix (SEC-002).
 * Passing several permissions means the caller needs ANY one of them.
 */
export async function requirePermission(
  req: NextRequest | undefined,
  permission: Permission | Permission[],
): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const result = await requireAuth(req)
  if (result.error) return result
  const needed = Array.isArray(permission) ? permission : [permission]
  if (!needed.some(p => hasPermission(result.caller.role as UserRole, p))) {
    return { error: NextResponse.json({ error: 'Your role does not allow this action' }, { status: 403 }) }
  }
  return result
}

export async function requireOrgAdmin(req?: NextRequest): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile(req)
  if (!caller || !ORG_ADMIN_ROLES.includes(caller.role as OrgAdminRole)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  const locked = await billingLockout(req, caller)
  if (locked) return { error: locked }
  return { caller }
}

export async function requirePlatformAdmin(req?: NextRequest): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile(req)
  if (!caller || caller.role !== 'platform_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { caller }
}
