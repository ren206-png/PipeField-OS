// GET  /api/pipe-support/calculations   → list for org (optional ?project_id=)
// POST /api/pipe-support/calculations   → save new calculation
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const saveSchema = z.object({
  name:       z.string().min(1).max(200),
  project_id: z.string().uuid().optional().nullable(),
  inputs:     z.record(z.unknown()),
  result:     z.record(z.unknown()),
  notes:      z.string().max(1000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const admin = createAdminClient()
    const projectId = req.nextUrl.searchParams.get('project_id')

    let q = admin
      .from('pipe_support_calculations')
      .select('*')
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: false })

    if (projectId) q = q.eq('project_id', projectId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/pipe-support/calculations GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const body = await req.json()
    const parsed = saveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request body' }, { status: 400 })
    }
    const { name, project_id, inputs, result, notes } = parsed.data

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pipe_support_calculations')
      .insert({
        organization_id: caller.organization_id,
        project_id:      project_id ?? null,
        name,
        inputs,
        result,
        notes:           notes ?? null,
        created_by:      caller.auth_user_id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    void admin.from('audit_logs').insert({
      organization_id: caller.organization_id,
      table_name:      'pipe_support_calculations',
      record_id:       data.id,
      action:          'INSERT',
      performed_by:    caller.auth_user_id,
      new_values:      { name, project_id: project_id ?? null },
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/pipe-support/calculations POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
