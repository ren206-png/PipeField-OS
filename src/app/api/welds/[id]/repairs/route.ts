// GET  /api/welds/[id]/repairs  → list all repairs for a weld
// POST /api/welds/[id]/repairs  → create a repair record
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  params: { id: string }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
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

    // Verify the weld belongs to the caller's org
    const { data: weld } = await supabase
      .from('welds')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (!weld) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('weld_repairs')
      .select('*')
      .eq('weld_id', params.id)
      .eq('organization_id', profile.organization_id)
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
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

    // Verify the weld belongs to the caller's org
    const { data: weld } = await supabase
      .from('welds')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    if (!weld) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    const body = await req.json()
    const parsed = repairSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('weld_repairs')
      .insert({
        ...parsed.data,
        weld_id:         params.id,
        organization_id: profile.organization_id,
        created_by:      user.id,
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
