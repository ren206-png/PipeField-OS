// PATCH  /api/welds/[id]/repairs/[repairId]  → update a repair record
// DELETE /api/welds/[id]/repairs/[repairId]  → hard delete
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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
  params: Promise<{ id: string; repairId: string }>
}

async function verifyOwnership(admin: ReturnType<typeof createAdminClient>, weldId: string, repairId: string, orgId: string) {
  const [{ data: weld }, { data: repair }] = await Promise.all([
    admin.from('welds').select('id').eq('id', weldId).eq('organization_id', orgId).maybeSingle(),
    admin.from('weld_repairs').select('id').eq('id', repairId).eq('weld_id', weldId).eq('organization_id', orgId).maybeSingle(),
  ])
  return !!(weld && repair)
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id, repairId } = await params
    const admin = createAdminClient()

    const ok = await verifyOwnership(admin, id, repairId, caller.organization_id)
    if (!ok) return NextResponse.json({ error: 'Repair not found' }, { status: 404 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request body' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('weld_repairs')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', repairId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/welds/[id]/repairs/[repairId] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id, repairId } = await params
    const admin = createAdminClient()

    const ok = await verifyOwnership(admin, id, repairId, caller.organization_id)
    if (!ok) return NextResponse.json({ error: 'Repair not found' }, { status: 404 })

    const { error } = await admin.from('weld_repairs').delete().eq('id', repairId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[/api/welds/[id]/repairs/[repairId] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
