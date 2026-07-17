// POST /api/excel/import/mtr-index
// Multipart: file (xlsx), dry_run ('true'|'false')
// Validates rows, optionally upserts mtr_documents by heat_number.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'
import { parseWorkbook, MTR_COLUMNS } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const HEADER_TO_KEY = Object.fromEntries(
  MTR_COLUMNS.map(c => [c.header, c.key])
) as Record<string, string>

interface ValidationError {
  row:     number
  field:   string
  message: string
}

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!OFFLINE_FIELD_ENABLED) {
    return NextResponse.json({ error: 'Excel I/O is not enabled for this environment.' }, { status: 403 })
  }

  if (!caller?.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const dry_run_raw = formData.get('dry_run') as string | null
  if (dry_run_raw === null) {
    return NextResponse.json({ error: 'dry_run param is required (true or false)' }, { status: 400 })
  }
  const dry_run = dry_run_raw === 'true'

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let parsed: { headers: string[]; rows: Record<string, string>[] }
  try {
    parsed = await parseWorkbook(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse workbook'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { rows } = parsed

  const mappedRows = rows.map(row => {
    const mapped: Record<string, string> = {}
    for (const [header, val] of Object.entries(row)) {
      const key = HEADER_TO_KEY[header]
      if (key) mapped[key] = val
    }
    return mapped
  })

  const errors: ValidationError[] = []
  mappedRows.forEach((row, i) => {
    const rowNum = i + 2
    if (!row.heat_number) {
      errors.push({ row: rowNum, field: 'Heat Number', message: 'Heat Number is required' })
    }
  })

  if (dry_run) {
    return NextResponse.json({
      valid_count: mappedRows.length - errors.map(e => e.row).filter((v, i, a) => a.indexOf(v) === i).length,
      error_count: errors.map(e => e.row).filter((v, i, a) => a.indexOf(v) === i).length,
      errors,
      preview:     mappedRows.slice(0, 5),
    })
  }

  if (errors.length > 0) {
    return NextResponse.json({ message: 'Fix validation errors first', errors }, { status: 422 })
  }

  const admin = createAdminClient()

  // mtrs table requires: organization_id, heat_number, material_spec, material_type
  const records = mappedRows.map(row => ({
    organization_id: caller.organization_id!,
    heat_number:     row.heat_number,
    material_spec:   row.material_spec   || 'Unknown',
    material_type:   'pipe' as const,
    status:          (row.cert_status as string) || 'received',
    supplier:        row.supplier        || null,
    po_number:       row.po_number       || null,
    received_date:   row.received_date   || null,
    notes:           row.notes           || null,
    created_by:      caller.id,
  }))

  const { data, error } = await admin
    .from('mtrs')
    .upsert(records, { onConflict: 'organization_id,heat_number', ignoreDuplicates: false })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: (data ?? []).length, updated: 0 })
}
