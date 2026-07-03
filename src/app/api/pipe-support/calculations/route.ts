// GET  /api/pipe-support/calculations   → list for org (optional ?project_id=)
// POST /api/pipe-support/calculations   → save new calculation
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const saveSchema = z.object({
  name:       z.string().min(1).max(200),
  project_id: z.string().uuid().optional().nullable(),
  inputs:     z.record(z.unknown()),
  result:     z.record(z.unknown()),
  notes:      z.string().max(1000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

    const projectId = req.nextUrl.searchParams.get('project_id')

    let q = supabase
      .from('pipe_support_calculations')
      .select('*')
      .eq('organization_id', profile.organization_id)
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
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

    const body = await req.json()
    const parsed = saveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { name, project_id, inputs, result, notes } = parsed.data

    const { data, error } = await supabase
      .from('pipe_support_calculations')
      .insert({
        organization_id: profile.organization_id,
        project_id:      project_id ?? null,
        name,
        inputs,
        result,
        notes:           notes ?? null,
        created_by:      user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit trail
    await supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      table_name:      'pipe_support_calculations',
      record_id:       data.id,
      action:          'INSERT',
      performed_by:    user.id,
      new_values:      { name, project_id: project_id ?? null },
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/pipe-support/calculations POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
