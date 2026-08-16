// TODO: Dead route — no direct frontend callers found as of 2026-08.
// Global standards data is accessed via /api/projects/[id]/standards instead.
// GET /api/standards — list all compliance standards (global reference data)
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth(req)
    if (authError) return authError

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('compliance_standards')
      .select('*')
      .order('standard_name', { ascending: true })
      .order('standard_edition', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/standards]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
