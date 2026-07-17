// GET  /api/welds/[id]/repairs  → list all repairs for a weld
// POST /api/welds/[id]/repairs  → create a repair record
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const repairSchema = z.object({
  repair_number:        z.number().int().min(1).default(1),
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
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id } = await params
    const admin = createAdminClient()

    const { data: weld } = await admin
      .from('welds').select('id').eq('id', id).eq('organization_id', caller.organization_id).maybeSingle()
    if (!weld) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    const { data, error } = await admin
      .from('weld_repairs')
      .select('*')
      .eq('weld_id', id)
      .eq('organization_id', caller.organization_id)
      .order('repair_number', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/welds/[id]/repairs GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const { id } = await params
    const admin = createAdminClient()

    const { data: weld } = await admin
      .from('welds').select('id').eq('id', id).eq('organization_id', caller.organization_id).maybeSingle()
    if (!weld) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    const body = await req.json()
    const parsed = repairSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid request body' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('weld_repairs')
      .insert({
        ...parsed.data,
        weld_id:         id,
        organization_id: caller.organization_id,
        created_by:      caller.auth_user_id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[/api/welds/[id]/repairs POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
