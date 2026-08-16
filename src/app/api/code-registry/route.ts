// ============================================================
// GET /api/code-registry
// Returns all active entries in the code_registry table.
// Used to populate the governing code selector in project settings.
// Optional: ?standard=ASME+B31.3 to filter by standard name.
//           ?region=US to filter by region (includes global entries).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth(req)
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const standard = searchParams.get('standard')
    const region   = searchParams.get('region')

    const admin = createAdminClient()
    let query = admin
      .from('code_registry')
      .select('id, standard, edition, label, regions')
      .eq('active', true)
      .order('standard')
      .order('edition', { ascending: false })

    if (standard) query = query.eq('standard', standard)
    // Region filter: rows where regions is NULL (global) OR regions contains the requested region
    if (region) query = query.or(`regions.is.null,regions.cs.{${region}}`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/code-registry]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
