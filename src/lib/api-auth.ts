// ============================================================
// API Route Auth Helpers
// Use these in every API route instead of copy-pasting
// the getCallerProfile pattern.
//
// All helpers:
//   • Read the session from the request cookie (anon key).
//   • Look up the user_profiles row via the service-role client
//     (bypasses RLS so we always get a reliable result).
//   • Return null if unauthenticated or the profile is missing.
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
/**
 * Resolve the authenticated caller's user_profiles row.
 * Returns null when the request has no valid session or the
 * profile row does not exist.
 *
 * @example
 * const caller = await getCallerProfile()
 * if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 */
export async function getCallerProfile(): Promise<CallerProfile | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, auth_user_id, role, organization_id, full_name, status')
    .eq('auth_user_id', user.id)
    .single()

  return profile ?? null
}

// ── Guard helpers ─────────────────────────────────────────────
/**
 * Require any authenticated user.
 * Returns { caller } on success, or a 401 NextResponse.
 */
export async function requireAuth(): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile()
  if (!caller) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { caller }
}

/**
 * Require the caller to be an org admin
 * (platform_admin | organization_owner | administrator).
 * Returns { caller } on success, or a 403 NextResponse.
 */
export async function requireOrgAdmin(): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile()
  if (!caller || !ORG_ADMIN_ROLES.includes(caller.role as OrgAdminRole)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { caller }
}

/**
 * Require the caller to be a platform admin.
 * Returns { caller } on success, or a 403 NextResponse.
 */
export async function requirePlatformAdmin(): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile()
  if (!caller || caller.role !== 'platform_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { caller }
}
