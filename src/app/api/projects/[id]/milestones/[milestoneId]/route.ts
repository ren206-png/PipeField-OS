// ============================================================
// PATCH  /api/projects/[id]/milestones/[milestoneId]
// DELETE /api/projects/[id]/milestones/[milestoneId]
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const patchSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  description:  z.string().max(500).optional().nullable(),
  planned_date: z.string().optional().nullable(),
  actual_date:  z.string().optional().nullable(),
  status:       z.enum(['pending', 'in_progress', 'complete', 'delayed']).optional(),
  sort_order:   z.number().int().optional(),
})

async function verifyOwnership(projectId: string, milestoneId: string, orgId: string) {
  const admin = createAdminClient()
  // Verify project belongs to org
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!project) return null

  // Verify milestone belongs to project
  const { data: milestone } = await admin
    .from('project_milestones')
    .select('id')
    .eq('id', milestoneId)
    .eq('project_id', projectId)
    .maybeSingle()

  return milestone
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    const { id: projectId, milestoneId } = await params

    const milestone = await verifyOwnership(projectId, milestoneId, caller.organization_id ?? '')
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('project_milestones')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', milestoneId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })

    return NextResponse.json({ milestone: data })
  } catch (err) {
    console.error('PATCH /milestones/[milestoneId] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    const { id: projectId, milestoneId } = await params

    const milestone = await verifyOwnership(projectId, milestoneId, caller.organization_id ?? '')
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('project_milestones')
      .delete()
      .eq('id', milestoneId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /milestones/[milestoneId] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
