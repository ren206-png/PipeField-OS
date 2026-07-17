// ============================================================
// GET /api/nde/selections — list selections for a plan
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NDE_ENGINE_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const ndePlanId = searchParams.get('nde_plan_id')
    if (!ndePlanId) {
      return NextResponse.json({ error: 'nde_plan_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('nde_selections')
      .select('*')
      .eq('nde_plan_id', ndePlanId)
      .eq('organization_id', caller.organization_id!)
      .order('inspection_type', { ascending: true })
      .order('selection_rank', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/nde/selections]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
