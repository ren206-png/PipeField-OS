// GET + PATCH /api/settings/enforcement
// Read and update org enforcement settings.
// Admin only for PATCH.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  void req
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_settings')
    .select('*')
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  // Return defaults if no row yet
  return NextResponse.json(data ?? {
    organization_id:      caller.organization_id,
    qual_enforcement_mode: 'FLAG',
    nde_engine_mode:       'OFF',
    continuity_window_hours: 6,
  })
}

export async function PATCH(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  if (!['admin', 'platform_admin'].includes(caller.role ?? '')) {
    return NextResponse.json({ error: 'Admin role required.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const allowed = ['qual_enforcement_mode', 'nde_engine_mode', 'continuity_window_hours']
  const update: Record<string, unknown> = { updated_by: caller.id, updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_settings')
    .upsert({ organization_id: caller.organization_id, ...update }, { onConflict: 'organization_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
