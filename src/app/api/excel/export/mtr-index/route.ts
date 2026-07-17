// GET /api/excel/export/mtr-index
// Exports MTR index for the org as an Excel workbook.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'
import { buildMtrWorkbook } from '@/lib/excel'

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
    .from('mtrs')
    .select('heat_number, material_spec, material_type, status, supplier, po_number, received_date, notes')
    .eq('organization_id', caller.organization_id)
    .order('received_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(m => ({
    heat_number:   m.heat_number   ?? '',
    material_spec: m.material_spec ?? '',
    grade:         m.material_type ?? '',
    cert_status:   m.status        ?? '',
    supplier:      m.supplier      ?? '',
    po_number:     m.po_number     ?? '',
    received_date: m.received_date ?? '',
    notes:         m.notes ?? '',
  }))

  const buffer = await buildMtrWorkbook(rows)

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mtr-index.xlsx"',
    },
  })
}
