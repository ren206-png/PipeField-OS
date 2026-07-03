// GET    /api/pipe-support/calculations/[id]  → single record
// PATCH  /api/pipe-support/calculations/[id]  → update name/notes
// DELETE /api/pipe-support/calculations/[id]  → delete record
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAuthContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile?.organization_id) return null
  return { user, orgId: profile.organization_id }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('pipe_support_calculations')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Calculation not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/pipe-support/calculations/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patch = await req.json()
    const allowed = ['name', 'notes', 'project_id']
    const update: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in patch) update[k] = patch[k]
    }
    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('pipe_support_calculations')
      .update(update)
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_logs').insert({
      organization_id: ctx.orgId,
      table_name:      'pipe_support_calculations',
      record_id:       id,
      action:          'UPDATE',
      performed_by:    ctx.user.id,
      new_values:      update,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/pipe-support/calculations/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const ctx = await getAuthContext(supabase)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('pipe_support_calculations')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_logs').insert({
      organization_id: ctx.orgId,
      table_name:      'pipe_support_calculations',
      record_id:       id,
      action:          'DELETE',
      performed_by:    ctx.user.id,
      new_values:      {},
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[/api/pipe-support/calculations/[id] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
