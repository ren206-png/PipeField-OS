// ============================================================
// PUT    /api/checklist-templates/[id]  — update template
// DELETE /api/checklist-templates/[id]  — delete template
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const itemSchema = z.object({
  id:       z.string().min(1),
  label:    z.string().min(1).max(200),
  required: z.boolean().default(false),
})

const updateSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  weld_type:   z.string().max(50).optional().nullable(),
  items:       z.array(itemSchema).min(1).max(50).optional(),
})

interface RouteContext { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { id } = await params
    const body   = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('checklist_templates')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('checklist-templates.put', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { id } = await params
    const admin  = createAdminClient()

    const { error } = await admin
      .from('checklist_templates')
      .delete()
      .eq('id', id)
      .eq('organization_id', caller.organization_id)

    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('checklist-templates.delete', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
