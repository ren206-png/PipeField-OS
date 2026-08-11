// ============================================================
// GET  /api/admin/users  — list all users across all orgs
// PATCH /api/admin/users — update any user's role or status
//
// Platform admin only. Uses service role key (bypasses RLS).
// Regular users receive 403 — checked against user_profiles.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Platform admins may assign any role including platform_admin itself
const ALL_VALID_ROLES = [
  'platform_admin',
  'organization_owner',
  'administrator',
  'project_manager',
  'foreman',
  'qa_inspector',
  'shop_fabricator',
  'pipefitter',
  'client_viewer',
] as const

const patchSchema = z.object({
  user_profile_id: z.string().uuid(),
  role:   z.enum(ALL_VALID_ROLES).optional(),
  status: z.enum(['active', 'deactivated', 'suspended']).optional(),
}).refine(d => d.role || d.status, { message: 'Provide at least role or status' })

// ── GET — fetch all users with org info ──────────────────────
export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin()
    if (authResult.error) return authResult.error
    const { caller } = authResult
    void caller

    const { searchParams } = new URL(req.url)
    const search     = (searchParams.get('search') ?? '').slice(0, 200)
    const orgId      = searchParams.get('org_id')     ?? ''
    const role       = searchParams.get('role')        ?? ''
    const status     = searchParams.get('status')      ?? ''
    const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const perPage    = 50

    const admin = createAdminClient()

    // Fetch profiles joined with organizations
    let query = admin
      .from('user_profiles')
      .select(`
        id,
        auth_user_id,
        email,
        full_name,
        phone,
        role,
        status,
        is_active,
        created_at,
        last_login_at,
        organization_id,
        organizations (
          id,
          name,
          slug,
          subscription_tier,
          subscription_status
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }
    if (orgId)  query = query.eq('organization_id', orgId)
    if (role)   query = query.eq('role', role)
    if (status) query = query.eq('status', status)

    const { data: users, error: listError, count } = await query

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    // Also fetch all auth users for last_sign_in_at
    // (Supabase admin API gives us this without exposing passwords)
    const { data: authList } = await admin.auth.admin.listUsers({
      page, perPage,
    })

    // Build a map of auth_user_id → last_sign_in_at
    const signInMap: Record<string, string | null> = {}
    authList?.users?.forEach(u => {
      signInMap[u.id] = u.last_sign_in_at ?? null
    })

    const enriched = users?.map(u => ({
      ...u,
      last_sign_in_at: signInMap[u.auth_user_id] ?? u.last_login_at ?? null,
    }))

    return NextResponse.json({
      users: enriched,
      total: count ?? 0,
      page,
      per_page: perPage,
    })
  } catch (err) {
    console.error('[/api/admin/users GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH — update a user's role or status ───────────────────
export async function PATCH(req: NextRequest) {
  try {
    const patchAuth = await requirePlatformAdmin()
    if (patchAuth.error) return patchAuth.error

    const parsed = patchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { user_profile_id, role, status } = parsed.data

    const update: Record<string, unknown> = {}
    if (role)   update.role   = role
    if (status) update.status = status
    if (status === 'deactivated') update.is_active = false
    if (status === 'active')      update.is_active = true

    const admin = createAdminClient()
    const { error: updateError } = await admin
      .from('user_profiles')
      .update(update)
      .eq('id', user_profile_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/admin/users PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
