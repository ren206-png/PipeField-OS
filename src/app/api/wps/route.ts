import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const wpsSchema = z.object({
  wps_number:           z.string().min(1).max(50),
  revision:             z.string().max(10).default('0'),
  process:              z.string().min(1).max(50),
  base_metal_p_numbers: z.string().max(100).optional().nullable(),
  filler_material:      z.string().max(100).optional().nullable(),
  thickness_min_in:     z.number().positive().optional().nullable(),
  thickness_max_in:     z.number().positive().optional().nullable(),
  position:             z.string().max(50).optional().nullable(),
  pwht_required:        z.boolean().default(false),
  notes:                z.string().max(500).optional().nullable(),
})

export async function GET() {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('wps_records')
      .select('*')
      .eq('organization_id', caller.organization_id!)
      .order('wps_number')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/wps]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    const body = await req.json()
    const parsed = wpsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('wps_records')
      .insert({ ...parsed.data, organization_id: caller.organization_id!, created_by: caller.auth_user_id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/wps]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
