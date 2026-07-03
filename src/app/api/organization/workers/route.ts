// ============================================================
// GET   /api/organization/workers — list workers in caller's org
// PATCH /api/organization/workers — update a worker's role/status
// DELETE /api/organization/workers — remove a worker from org
//
// Accessible by organization_owner, administrator, platform_admin.
// All queries are scoped to the caller's organization_id.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAdmin } from '@/lib/api-auth'
import { z } from 'zod'

const patchSchema = z.object({
  worker_profile_id: z.string().uuid(),
  role:   z.string().optional(),
  status: z.enum(['active', 'deactivated', 'suspended']).optional(),
}).refine(d => d.role || d.status, { message: 'Provide at least role or status' })

// ── GET — list workers in org ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const getAuth = await requireOrgAdmin()
    if (getAuth.error) return getAuth.error
    const { caller } = getAuth

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const role   = searchParams.get('role')   ?? ''
    const status = searchParams.get('status') ?? ''

    const admin = createAdminClient()

    let query = admin
      .from('user_profiles')
      .select('id, auth_user_id, email, full_name, phone, role, status, is_active, created_at, last_login_at, organization_id')
      .eq('organization_id', caller.organization_id)
      .order('full_name', { ascending: true })

    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    if (role)   query = query.eq('role', role)
    if (status) query = query.eq('status', status)

    const { data: workers, error: listError } = await query

    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    return NextResponse.json({ workers: workers ?? [] })
  } catch (err) {
    console.error('[/api/organization/workers GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH — update role or status ────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const patchAuth = await requireOrgAdmin()
    if (patchAuth.error) return patchAuth.error
    const { caller } = patchAuth

    const parsed = patchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { worker_profile_id, role, status } = parsed.data

    const admin = createAdminClient()

    // Verify target worker is in the same org (unless platform_admin)
    if (caller.role !== 'platform_admin') {
      const { data: target } = await admin
        .from('user_profiles')
        .select('organization_id')
        .eq('id', worker_profile_id)
        .maybeSingle()

      if (!target || target.organization_id !== caller.organization_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (role)   update.role      = role
    if (status) update.status    = status
    if (status === 'deactivated') update.is_active = false
    if (status === 'active')      update.is_active = true

    const { error: updateError } = await admin
      .from('user_profiles')
      .update(update)
      .eq('id', worker_profile_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/organization/workers PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE — remove worker from org (deactivate, not hard-delete)
export async function DELETE(req: NextRequest) {
  try {
    const delAuth = await requireOrgAdmin()
    if (delAuth.error) return delAuth.error
    const { caller } = delAuth

    const { searchParams } = new URL(req.url)
    const workerProfileId = searchParams.get('id')

    if (!workerProfileId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify same org
    if (caller.role !== 'platform_admin') {
      const { data: target } = await admin
        .from('user_profiles')
        .select('organization_id, role')
        .eq('id', workerProfileId)
        .maybeSingle()

      if (!target || target.organization_id !== caller.organization_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Prevent removing org owner
      if (target.role === 'organization_owner') {
        return NextResponse.json({ error: 'Cannot remove organization owner' }, { status: 400 })
      }
    }

    // Soft-delete: deactivate rather than hard-delete
    const { error: deleteError } = await admin
      .from('user_profiles')
      .update({ status: 'deactivated', is_active: false })
      .eq('id', workerProfileId)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/organization/workers DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
