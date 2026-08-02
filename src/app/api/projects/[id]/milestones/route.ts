// ============================================================
// GET  /api/projects/[id]/milestones  — list milestones
// POST /api/projects/[id]/milestones  — create milestone
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name:         z.string().min(1).max(200),
  description:  z.string().max(500).optional().nullable(),
  planned_date: z.string().optional().nullable(),
  actual_date:  z.string().optional().nullable(),
  status:       z.enum(['pending', 'in_progress', 'complete', 'delayed']).default('pending'),
  sort_order:   z.number().int().default(0),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { id: projectId } = await params
    const admin = createAdminClient()

    // Verify project belongs to caller's org
    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .eq('organization_id', caller.organization_id ?? '')
      .maybeSingle()

    if (projectError) throw projectError
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('planned_date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ milestones: data ?? [] })
  } catch (err) {
    console.error('GET /milestones error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const { id: projectId } = await params
    const admin = createAdminClient()

    // Verify project belongs to caller's org
    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .eq('organization_id', caller.organization_id ?? '')
      .maybeSingle()

    if (projectError) throw projectError
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await admin
      .from('project_milestones')
      .insert({
        ...parsed.data,
        project_id: projectId,
        organization_id: project.organization_id,
        created_by: caller.auth_user_id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ milestone: data }, { status: 201 })
  } catch (err) {
    console.error('POST /milestones error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
