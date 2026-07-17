// ============================================================
// GET  /api/flanges?project_id=  — list flanges for a project
// POST /api/flanges              — create a new flange
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const PostSchema = z.object({
  project_id:       z.string().uuid(),
  flange_number:    z.string().min(1).max(100),
  flange_type:      z.enum(['weld_neck', 'slip_on', 'blind', 'socket_weld', 'threaded', 'lap_joint', 'orifice']).default('weld_neck'),
  pressure_class:   z.enum(['150', '300', '600', '900', '1500', '2500']).default('150'),
  size_inches:      z.number().positive().optional().nullable(),
  material_spec:    z.string().max(500).optional().nullable(),
  heat_number:      z.string().max(100).optional().nullable(),
  bolt_torque_spec: z.string().max(500).optional().nullable(),
  gasket_type:      z.string().max(200).optional().nullable(),
  notes:            z.string().max(5000).optional().nullable(),
})

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id query param is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('flanges')
    .select('*')
    .eq('organization_id', caller.organization_id)
    .eq('project_id', projectId)
    .order('flange_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// ── POST ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
      { status: 400 },
    )
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
    .from('flanges')
    .insert({ ...parsed.data, organization_id: caller.organization_id })
    .select()
    .single()

  if (error) {
    // Unique constraint on (project_id, flange_number)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Flange number "${parsed.data.flange_number}" already exists in this project` },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
