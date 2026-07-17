// ============================================================
// GET /api/turnover/packages/[id] — fetch single package (for polling)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { TURNOVER_GEN_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!TURNOVER_GEN_ENABLED) {
      return NextResponse.json({ error: 'Turnover Generator is not enabled' }, { status: 403 })
    }

    const { id } = await params

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('turnover_packages')
      .select('*')
      .eq('id', id)
      .eq('organization_id', caller.organization_id!)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/turnover/packages/[id]]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
