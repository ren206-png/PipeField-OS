// GET /api/excel/export/weld-log?project_id=<uuid>
// Exports welds for an org+project as an Excel workbook.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'
import { buildWeldLogWorkbook } from '@/lib/excel'

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

  const project_id = req.nextUrl.searchParams.get('project_id')?.trim()
  if (!project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('welds')
    .select(
      'weld_id_number, welder_stamp, weld_date, status, notes, wall_thickness, weld_process, base_metal_heat_a, base_metal_heat_b, filler_batch_number'
    )
    .eq('organization_id', caller.organization_id)
    .eq('project_id', project_id)
    .order('weld_id_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(w => ({
    weld_number:         w.weld_id_number,
    joint_type:          '',
    size_inches:         '',
    wall_thickness:      w.wall_thickness ?? '',
    process:             w.weld_process ?? '',
    position:            '',
    welder_stamp:        w.welder_stamp ?? '',
    wps_number:          '',
    weld_date:           w.weld_date ?? '',
    base_metal_heat_a:   w.base_metal_heat_a ?? '',
    base_metal_heat_b:   w.base_metal_heat_b ?? '',
    filler_batch_number: w.filler_batch_number ?? '',
    status:              w.status ?? '',
    notes:               w.notes ?? '',
  }))

  const buffer = await buildWeldLogWorkbook(rows)

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="weld-log-${project_id}.xlsx"`,
    },
  })
}
