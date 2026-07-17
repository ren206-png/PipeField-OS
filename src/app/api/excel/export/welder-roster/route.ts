// GET /api/excel/export/welder-roster
// Exports all welders for the org as an Excel workbook.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'
import { buildWelderRosterWorkbook } from '@/lib/excel'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!OFFLINE_FIELD_ENABLED) {
    return NextResponse.json({ error: 'Excel I/O is not enabled for this environment.' }, { status: 403 })
  }

  if (!caller?.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('welders')
    .select('stamp, full_name, cert_expiry, process, position')
    .eq('organization_id', caller.organization_id)
    .order('stamp')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(w => {
    const nameParts = (w.full_name ?? '').split(' ')
    const first_name = nameParts[0] ?? ''
    const last_name  = nameParts.slice(1).join(' ')
    return {
      stamp:       w.stamp ?? '',
      first_name,
      last_name,
      cert_expiry: w.cert_expiry ?? '',
      process:     Array.isArray(w.process) ? w.process.join(', ') : (w.process ?? ''),
      position:    Array.isArray(w.position) ? w.position.join(', ') : (w.position ?? ''),
      wps_numbers: '',
    }
  })

  const buffer = await buildWelderRosterWorkbook(rows)

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="welder-roster.xlsx"',
    },
  })
}
