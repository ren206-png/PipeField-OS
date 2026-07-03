// PATCH  /api/welds/[id]/repairs/[repairId]  → update a repair record
// DELETE /api/welds/[id]/repairs/[repairId]  → hard delete
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const patchSchema = z.object({
  repair_number:        z.number().int().min(1).optional(),
  failure_mode:         z.string().max(200).optional().nullable(),
  repair_method:        z.string().max(200).optional().nullable(),
  authorized_by:        z.string().max(100).optional().nullable(),
  repair_welder_stamp:  z.string().max(20).optional().nullable(),
  repair_welder_name:   z.string().max(100).optional().nullable(),
  repair_date:          z.string().optional().nullable(),
  re_inspection_type:   z.string().max(50).optional().nullable(),
  re_inspection_result: z.enum(['pass', 'fail', 'pending']).optional().nullable(),
  re_inspection_date:   z.string().optional().nullable(),
  notes:                z.string().max(1000).optional().nullable(),
})

interface RouteContext {
  params: { id: string; repairId: string }
}

async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, weldId: string, repairId: string, orgId: string) {
  const { data: weld } = await supabase
    .from('welds')
    .select('id')
    .eq('id', weldId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!weld) return false

  const { data: repair } = await supabase
    .from('weld_repairs')
    .select('id')
    .eq('id', repairId)
    .eq('weld_id', weldId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return !!repair
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

    const ok = await verifyOwnership(supabase, params.id, params.repairId, profile.organization_id)
    if (!ok) return NextResponse.json({ error: 'Repair not found' }, { status: 404 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('weld_repairs')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.repairId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/welds/[id]/repairs/[repairId] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
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

    const ok = await verifyOwnership(supabase, params.id, params.repairId, profile.organization_id)
    if (!ok) return NextResponse.json({ error: 'Repair not found' }, { status: 404 })

    const { error } = await supabase
      .from('weld_repairs')
      .delete()
      .eq('id', params.repairId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[/api/welds/[id]/repairs/[repairId] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
