// ============================================================
// GET /api/turnover/gap-check — run completeness gap check for a project
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { TURNOVER_GEN_ENABLED } from '@/intelligence/flags'
import { runGapCheck } from '@/lib/turnover-gap-check'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!TURNOVER_GEN_ENABLED) {
      return NextResponse.json({ error: 'Turnover Generator is not enabled' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const report = await runGapCheck(admin, projectId, caller.organization_id!)

    return NextResponse.json(report)
  } catch (err) {
    console.error('[GET /api/turnover/gap-check]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
