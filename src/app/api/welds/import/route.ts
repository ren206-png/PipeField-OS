// ============================================================
// POST /api/welds/import
// Bulk-imports welds from a parsed CSV payload.
// Validates each row, inserts all valid rows, and returns
// a summary of imported vs skipped rows.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const rowSchema = z.object({
  weld_id_number: z.string().min(1, 'Weld ID is required').max(50),
  project_id:     z.string().uuid('Invalid project ID'),
  welder_name:    z.string().max(100).optional().nullable(),
  welder_stamp:   z.string().max(10).optional().nullable(),
  weld_date:      z.string().optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
})

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body   = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid payload' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify all project IDs belong to the caller's org
    const uniqueProjectIds = Array.from(new Set(parsed.data.rows.map(r => r.project_id)))
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .eq('organization_id', caller.organization_id)
      .in('id', uniqueProjectIds)

    const validProjectIds = new Set((projects ?? []).map(p => p.id))
    const invalidProjects = uniqueProjectIds.filter(id => !validProjectIds.has(id))
    if (invalidProjects.length > 0) {
      return NextResponse.json(
        { error: `Project ID(s) not found in your organization: ${invalidProjects.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for existing weld_id_numbers in those projects to avoid dupes
    const { data: existing } = await admin
      .from('welds')
      .select('weld_id_number, project_id')
      .eq('organization_id', caller.organization_id)

    const existingKeys = new Set(
      (existing ?? []).map(w => `${w.project_id}::${w.weld_id_number}`)
    )

    const toInsert = []
    const skipped: { row: number; reason: string }[] = []

    for (let i = 0; i < parsed.data.rows.length; i++) {
      const row = parsed.data.rows[i]
      const key = `${row.project_id}::${row.weld_id_number}`

      if (existingKeys.has(key)) {
        skipped.push({ row: i + 1, reason: `Weld ${row.weld_id_number} already exists in this project` })
        continue
      }

      existingKeys.add(key) // prevent dupes within the same import batch
      toInsert.push({
        organization_id: caller.organization_id,
        project_id:      row.project_id,
        weld_id_number:  row.weld_id_number.trim(),
        welder_name:     row.welder_name  || null,
        welder_stamp:    row.welder_stamp ? row.welder_stamp.toUpperCase().trim() : null,
        weld_date:       row.weld_date    || null,
        notes:           row.notes        || null,
        status:          'draft',
        created_by:      caller.id,
      })
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: skipped.length,
        skipped_details: skipped,
        message: 'All rows were duplicates — nothing imported.',
      })
    }

    const { error: insertError } = await admin.from('welds').insert(toInsert)
    if (insertError) {
      console.error('[/api/welds/import]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Audit log
    await admin.from('audit_logs').insert({
      organization_id: caller.organization_id,
      table_name:      'welds',
      record_id:       caller.organization_id,
      action:          'INSERT',
      new_values:      { imported: toInsert.length, skipped: skipped.length },
      performed_by:    caller.id,
    // fire-and-forget — ignore errors
    }).then(() => {/* noop */}, () => {/* noop */})

    return NextResponse.json({
      imported:        toInsert.length,
      skipped:         skipped.length,
      skipped_details: skipped,
    })

  } catch (err) {
    console.error('[/api/welds/import]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
