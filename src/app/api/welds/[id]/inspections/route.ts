// GET + POST /api/welds/[id]/inspections — list and create weld inspections
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  inspection_template_id: z.string().uuid().optional(),
  inspection_type: z.enum(['VISUAL', 'RADIOGRAPHIC', 'ULTRASONIC', 'MAGNETIC_PARTICLE']),
  findings: z.record(z.unknown()).optional(),
  defects: z.array(z.record(z.unknown())).optional(),
  pass_fail: z.enum(['PASS', 'FAIL', 'CONDITIONAL']),
  inspection_date: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify the weld belongs to the caller's org
    const { data: weld } = await admin
      .from('welds')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!weld) {
      return NextResponse.json({ error: 'Weld not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('weld_inspections')
      .select('*, inspection_templates(id, name)')
      .eq('weld_id', params.id)
      .eq('organization_id', caller.organization_id)
      .order('inspection_date', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/welds/[id]/inspections]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify the weld belongs to the caller's org
    const { data: weld } = await admin
      .from('welds')
      .select('id')
      .eq('id', params.id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!weld) {
      return NextResponse.json({ error: 'Weld not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('weld_inspections')
      .insert({
        ...parsed.data,
        weld_id: params.id,
        organization_id: caller.organization_id,
        inspector_id: caller.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/welds/[id]/inspections]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
