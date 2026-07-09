// ============================================================
// API Route Auth Helpers
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
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
  return { caller }
}

export async function requireOrgAdmin(req?: NextRequest): Promise<
  { caller: CallerProfile; error?: never } |
  { caller?: never; error: NextResponse }
> {
  const caller = await getCallerProfile(req)
  if (!caller || !ORG_ADMIN_ROLES.includes(caller.role as OrgAdminRole)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
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
