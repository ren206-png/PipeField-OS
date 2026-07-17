// GET /api/material-trace?q=A1234B
// Runs batch_recall SQL function and returns affected welds + MTR status

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { MATERIAL_TRACE_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!MATERIAL_TRACE_ENABLED) {
    return NextResponse.json({ error: 'Material Trace is not enabled' }, { status: 403 })
  }
  if (!caller?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ error: 'Search term required (min 2 chars)' }, { status: 400 })

  const admin = createAdminClient()

  // Run batch-recall function
  const { data: welds, error: weldError } = await admin.rpc('batch_recall', {
    p_organization_id: caller.organization_id,
    p_heat_or_batch: q,
  })
  if (weldError) return NextResponse.json({ error: weldError.message }, { status: 500 })

  // Get MTR status for this heat number
  const { data: mtrs } = await admin
    .from('mtrs')
    .select('id, heat_number, material_spec, material_type, status, supplier')
    .eq('organization_id', caller.organization_id)
    .eq('heat_number', q)

  const critical = (mtrs ?? []).some(m => m.status === 'rejected' || m.status === 'quarantine')

  return NextResponse.json({
    query: q,
    welds: welds ?? [],
    totalWelds: (welds ?? []).length,
    mtrs: mtrs ?? [],
    severity: critical ? 'critical' : (welds ?? []).length > 0 ? 'info' : 'not_found',
  })
}
