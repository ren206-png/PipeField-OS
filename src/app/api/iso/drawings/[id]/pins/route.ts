// ============================================================
// GET + POST /api/iso/drawings/[id]/pins
// GET: list pins for a drawing (with weld details joined)
// POST: add a pin to a drawing
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const pinSchema = z.object({
  weld_number_label: z.string().min(1).max(100),
  x_pct:             z.number().min(0).max(100),
  y_pct:             z.number().min(0).max(100),
  page_number:       z.number().int().positive().optional().default(1),
  weld_id:           z.string().uuid().optional().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

async function verifyDrawing(drawingId: string, orgId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('iso_drawings')
    .select('id, organization_id')
    .eq('id', drawingId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const { id } = await params
  const drawing = await verifyDrawing(id, caller.organization_id)
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('iso_weld_pins')
    .select(`
      id,
      weld_number_label,
      x_pct,
      y_pct,
      page_number,
      weld_id,
      created_at,
      welds (
        id,
        weld_id_number,
        status,
        welder_name,
        weld_date,
        wps_id
      )
    `)
    .eq('drawing_id', id)
    .eq('organization_id', caller.organization_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const { id } = await params
  const drawing = await verifyDrawing(id, caller.organization_id)
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

  const body = await req.json()
  const parsed = pinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('iso_weld_pins')
    .insert({
      organization_id:   caller.organization_id,
      drawing_id:        id,
      weld_number_label: parsed.data.weld_number_label,
      x_pct:             parsed.data.x_pct,
      y_pct:             parsed.data.y_pct,
      page_number:       parsed.data.page_number,
      weld_id:           parsed.data.weld_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
