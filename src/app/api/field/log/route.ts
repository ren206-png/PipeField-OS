// GET  /api/field/log  — fetch caller's own log entries (paginated, most recent first)
// POST /api/field/log  — append a new log entry (INSERT only — no UPDATE path exists)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { FLAGS } from '@/intelligence/flags'

// ── Input schema ──────────────────────────────────────────────
const LogEntrySchema = z.object({
  event_type:      z.enum(['welded', 'fit_up', 'note', 'correction']),
  weld_id:         z.string().uuid().optional(),
  spool_id:        z.string().uuid().optional(),
  project_name:    z.string().max(200).optional(),
  joint_number:    z.string().max(50).optional(),
  weld_process:    z.string().max(50).optional(),
  welder_stamp:    z.string().max(50).optional(),
  note:            z.string().max(2000).optional(),
  corrects_row_id: z.string().uuid().optional(),
  source:          z.enum(['manual', 'scan', 'voice']).default('manual'),
  logged_at:       z.string().datetime().optional(), // client can back-date within same shift
})

// ── GET — paginated personal log ──────────────────────────────
export async function GET(req: NextRequest) {
  if (!FLAGS.PFOS_FIELD_MODE || !FLAGS.PFOS_FIELD_PERSONAL_LOG) {
    return NextResponse.json({ error: 'Field personal log is not enabled' }, { status: 403 })
  }

  const { caller, error } = await requireAuth(req)
  if (error) return error

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization associated with this account' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const cursor = searchParams.get('cursor') // ISO date string — entries before this date

  const supabase = await createClient()

  let query = supabase
    .from('personal_work_log')
    .select(
      'id, event_type, logged_at, project_name, joint_number, weld_process, welder_stamp, nde_result, nde_released_at, note, source, corrects_row_id, weld_id, spool_id, created_at'
    )
    .eq('auth_user_id', caller.auth_user_id)
    .eq('organization_id', caller.organization_id)
    .order('logged_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('logged_at', cursor)
  }

  const { data, error: dbError } = await query

  if (dbError) {
    console.error('[field/log GET]', dbError)
    return NextResponse.json({ error: 'Failed to fetch log entries' }, { status: 500 })
  }

  return NextResponse.json({
    entries: data ?? [],
    next_cursor: data && data.length === limit ? data[data.length - 1].logged_at : null,
  })
}

// ── POST — append a new log entry ─────────────────────────────
export async function POST(req: NextRequest) {
  if (!FLAGS.PFOS_FIELD_MODE || !FLAGS.PFOS_FIELD_PERSONAL_LOG) {
    return NextResponse.json({ error: 'Field personal log is not enabled' }, { status: 403 })
  }

  const { caller, error } = await requireAuth(req)
  if (error) return error

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization associated with this account' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = LogEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const input = parsed.data

  const supabase = await createClient()

  // INSERT only — no UPDATE path exists anywhere in this route
  const { data: row, error: dbError } = await supabase
    .from('personal_work_log')
    .insert({
      organization_id: caller.organization_id,
      auth_user_id:    caller.auth_user_id,
      event_type:      input.event_type,
      weld_id:         input.weld_id ?? null,
      spool_id:        input.spool_id ?? null,
      project_name:    input.project_name ?? null,
      joint_number:    input.joint_number ?? null,
      weld_process:    input.weld_process ?? null,
      welder_stamp:    input.welder_stamp ?? null,
      note:            input.note ?? null,
      corrects_row_id: input.corrects_row_id ?? null,
      source:          input.source,
      logged_at:       input.logged_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (dbError) {
    console.error('[field/log POST]', dbError)
    return NextResponse.json({ error: 'Failed to create log entry' }, { status: 500 })
  }

  return NextResponse.json({ entry: row }, { status: 201 })
}
