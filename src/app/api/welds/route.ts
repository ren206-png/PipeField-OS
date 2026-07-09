// POST /api/welds — create a new weld
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  project_id:     z.string().uuid(),
  weld_id_number: z.string().min(1).max(50),
  welder_stamp:   z.string().max(10).optional().nullable(),
  welder_name:    z.string().max(100).optional().nullable(),
  status:         z.string().optional().default('not_welded'),
  weld_date:      z.string().optional().nullable(),
  notes:          z.string().max(1000).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify project belongs to caller's org
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', parsed.data.project_id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('welds')
    .insert({
      ...parsed.data,
      organization_id: caller.organization_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
