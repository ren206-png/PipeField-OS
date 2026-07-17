// ============================================================
// GET  /api/checklist-templates  — list org templates
// POST /api/checklist-templates  — create a template
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

const createSchema = z.object({
  name:        z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  weld_type:   z.string().max(50).optional().nullable(),
  items:       z.array(itemSchema).min(1).max(50),
})

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('checklist_templates')
      .select('*')
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('checklist-templates.get', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const body   = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('checklist_templates')
      .insert({
        organization_id: caller.organization_id,
        created_by:      caller.auth_user_id,
        ...parsed.data,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('checklist-templates.post', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
