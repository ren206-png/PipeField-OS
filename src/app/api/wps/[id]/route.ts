import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  wps_number:           z.string().min(1).max(50).optional(),
  revision:             z.string().max(10).optional(),
  process:              z.string().min(1).max(50).optional(),
  base_metal_p_numbers: z.string().max(100).optional().nullable(),
  filler_material:      z.string().max(100).optional().nullable(),
  thickness_min_in:     z.number().positive().optional().nullable(),
  thickness_max_in:     z.number().positive().optional().nullable(),
  position:             z.string().max(50).optional().nullable(),
  pwht_required:        z.boolean().optional(),
  is_active:            z.boolean().optional(),
  notes:                z.string().max(500).optional().nullable(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('wps_records')
      .select('*')
      .eq('id', id)
      .eq('organization_id', caller.organization_id!)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/wps/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('wps_records')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', caller.organization_id!)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'WPS record not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[PATCH /api/wps/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    const supabase = await createClient()
    // Block delete if welds reference this WPS
    const { count } = await supabase
      .from('welds')
      .select('id', { count: 'exact', head: true })
      .eq('wps_id', id)
    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${count} weld(s) reference this WPS. Set it inactive instead.` },
        { status: 409 }
      )
    }
    const { error } = await supabase
      .from('wps_records')
      .delete()
      .eq('id', id)
      .eq('organization_id', caller.organization_id!)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/wps/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
