// POST /api/excel/import/weld-log
// Multipart: file (xlsx), project_id, dry_run ('true'|'false')
// Validates rows, optionally upserts welds.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'
import { parseWorkbook, WELD_LOG_COLUMNS } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['pending', 'in_progress', 'accepted', 'rejected', 'requires_repair']

// Build header→key map from column definitions
const HEADER_TO_KEY = Object.fromEntries(
  WELD_LOG_COLUMNS.map(c => [c.header, c.key])
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

  const project_id = (formData.get('project_id') as string | null)?.trim()
  if (!project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
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

  // Map header names to DB keys
  const mappedRows = rows.map(row => {
    const mapped: Record<string, string> = {}
    for (const [header, val] of Object.entries(row)) {
      const key = HEADER_TO_KEY[header]
      if (key) mapped[key] = val
    }
    return mapped
  })

  // Validate
  const errors: ValidationError[] = []
  mappedRows.forEach((row, i) => {
    const rowNum = i + 2 // 1-indexed, row 1 is header
    if (!row.weld_number) {
      errors.push({ row: rowNum, field: 'Weld Number', message: 'Weld Number is required' })
    }
    if (row.status && !VALID_STATUSES.includes(row.status)) {
      errors.push({
        row:     rowNum,
        field:   'Status',
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      })
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

  // Upsert
  const admin = createAdminClient()

  const records = mappedRows.map(row => ({
    organization_id:     caller.organization_id!,
    project_id,
    weld_id_number:      row.weld_number,
    wall_thickness:      row.wall_thickness || null,
    weld_process:        row.process        || null,
    welder_stamp:        row.welder_stamp   || null,
    weld_date:           row.weld_date      || null,
    base_metal_heat_a:   row.base_metal_heat_a   || null,
    base_metal_heat_b:   row.base_metal_heat_b   || null,
    filler_batch_number: row.filler_batch_number || null,
    status:              row.status         || 'draft',
    notes:               row.notes          || null,
  }))

  // Need created_by for insert — use caller's profile id
  const recordsWithCreator = records.map(r => ({ ...r, created_by: caller.id }))

  const { data, error } = await admin
    .from('welds')
    .upsert(recordsWithCreator, {
      onConflict:        'project_id,weld_id_number',
      ignoreDuplicates:  false,
    })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: (data ?? []).length, updated: 0 })
}
