// ============================================================
// GET  /api/org/flags  — return this org's flag overrides
// PATCH /api/org/flags — upsert a flag override (admin only)
// DELETE /api/org/flags?flag=FLAG_NAME — remove override (revert to env var)
//
// Resolution order (client should implement):
//   org_feature_flags row > NEXT_PUBLIC_* env var > false
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { FLAGS, type FlagName } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

const VALID_FLAGS = Object.keys(FLAGS) as FlagName[]
const ADMIN_ROLES = ['platform_admin','organization_owner','administrator']

const patchSchema = z.object({
  flag_name: z.string().refine(f => VALID_FLAGS.includes(f as FlagName), {
    message: `flag_name must be one of: ${VALID_FLAGS.join(', ')}`,
  }),
  enabled:  z.boolean(),
  metadata: z.record(z.unknown()).optional().nullable(),
})

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    const orgId = caller.organization_id
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('org_feature_flags')
      .select('flag_name, enabled, metadata, updated_at')
      .eq('org_id', orgId)
      .order('flag_name')

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/org/flags]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    const orgId = caller.organization_id
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    if (!ADMIN_ROLES.includes(caller.role)) {
      return NextResponse.json({ error: 'Admin role required to modify feature flags' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('org_feature_flags')
      .upsert({
        org_id:     orgId,
        flag_name:  parsed.data.flag_name,
        enabled:    parsed.data.enabled,
        metadata:   parsed.data.metadata ?? null,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,flag_name' })
      .select('flag_name, enabled, metadata, updated_at')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[PATCH /api/org/flags]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    const orgId = caller.organization_id
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    if (!ADMIN_ROLES.includes(caller.role)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const flagName = searchParams.get('flag')
    if (!flagName) return NextResponse.json({ error: 'flag query param required' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('org_feature_flags')
      .delete()
      .eq('org_id', orgId)
      .eq('flag_name', flagName)

    if (error) throw error
    return NextResponse.json({ deleted: true, flag_name: flagName })
  } catch (err) {
    console.error('[DELETE /api/org/flags]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
