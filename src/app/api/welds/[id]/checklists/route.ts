// ============================================================
// GET  /api/welds/[id]/checklists  — list checklists for a weld
// POST /api/welds/[id]/checklists  — apply a template to a weld
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const applySchema = z.object({
  template_id: z.string().uuid(),
})

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { id: weldId } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('weld_checklists')
      .select('*')
      .eq('weld_id', weldId)
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('weld-checklists.get', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { id: weldId } = await params
    const body    = await req.json()
    const parsed  = applySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'template_id (UUID) is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify weld belongs to org
    const { data: weld } = await admin
      .from('welds')
      .select('id')
      .eq('id', weldId)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()
    if (!weld) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    // Fetch template
    const { data: tmpl } = await admin
      .from('checklist_templates')
      .select('*')
      .eq('id', parsed.data.template_id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()
    if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    // Build items from template — no checked state yet
    const items = ((tmpl.items as Array<{ id: string; label: string; required: boolean }>) ?? []).map(item => ({
      ...item,
      checked:    false,
      checked_at: null,
      checked_by: null,
    }))

    const { data, error } = await admin
      .from('weld_checklists')
      .insert({
        organization_id: caller.organization_id,
        weld_id:         weldId,
        template_id:     tmpl.id,
        template_name:   tmpl.name,
        items,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('weld-checklists.post', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
