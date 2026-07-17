// ============================================================
// GET /api/nde/plans  — list plans for a project
// POST /api/nde/plans — create an NDE plan
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NDE_ENGINE_ENABLED } from '@/intelligence/flags'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  project_id:      z.string().uuid(),
  code_profile_id: z.string().uuid(),
  plan_date:       z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('nde_plans')
      .select(`
        *,
        code_profile:nde_code_profiles(profile_name, acceptance_standard),
        selections:nde_selections(id)
      `)
      .eq('organization_id', caller.organization_id!)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to include selection count
    const plans = (data ?? []).map(plan => ({
      ...plan,
      selection_count: Array.isArray(plan.selections) ? plan.selections.length : 0,
      selections: undefined,
    }))

    return NextResponse.json(plans)
  } catch (err) {
    console.error('[GET /api/nde/plans]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('nde_plans')
      .insert({
        organization_id: caller.organization_id!,
        project_id:      parsed.data.project_id,
        code_profile_id: parsed.data.code_profile_id,
        plan_date:       parsed.data.plan_date ?? new Date().toISOString().split('T')[0],
        created_by:      caller.id,
      })
      .select(`
        *,
        code_profile:nde_code_profiles(profile_name, acceptance_standard)
      `)
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/nde/plans]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
