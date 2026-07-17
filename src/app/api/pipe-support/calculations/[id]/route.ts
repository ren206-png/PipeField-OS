// GET    /api/pipe-support/calculations/[id]  → single record
// PATCH  /api/pipe-support/calculations/[id]  → update name/notes
// DELETE /api/pipe-support/calculations/[id]  → delete record
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id } = await params
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pipe_support_calculations')
      .select('*')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/pipe-support/calculations/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id } = await params
    const patch = await req.json() as Record<string, unknown>
    const allowed = ['name', 'notes', 'project_id']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (k in patch) update[k] = patch[k]
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pipe_support_calculations')
      .update(update)
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    void admin.from('audit_logs').insert({
      organization_id: caller.organization_id,
      table_name:      'pipe_support_calculations',
      record_id:       id,
      action:          'UPDATE',
      performed_by:    caller.auth_user_id,
      new_values:      update,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/pipe-support/calculations/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id } = await params
    const admin = createAdminClient()

    const { error } = await admin
      .from('pipe_support_calculations')
      .delete()
      .eq('id', id)
      .eq('organization_id', caller.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    void admin.from('audit_logs').insert({
      organization_id: caller.organization_id,
      table_name:      'pipe_support_calculations',
      record_id:       id,
      action:          'DELETE',
      performed_by:    caller.auth_user_id,
      new_values:      {},
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[/api/pipe-support/calculations/[id] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
