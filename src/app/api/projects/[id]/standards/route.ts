// ============================================================
// PATCH /api/projects/[id]/standards
// Update the international-standards configuration for a project.
// Fields: governing_code, governing_code_year, jurisdiction,
//         unit_system, locale, ahj, page_size
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  governing_code:      z.string().max(100).optional().nullable(),
  governing_code_year: z.number().int().min(1900).max(2100).optional().nullable(),
  jurisdiction:        z.string().max(20).optional().nullable(),
  unit_system:         z.enum(['imperial', 'si', 'mixed']).optional(),
  locale:              z.string().max(20).optional(),
  ahj:                 z.string().max(500).optional().nullable(),
  page_size:           z.enum(['letter', 'A4']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const orgId = caller.organization_id
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify project belongs to caller's org
    const { data: project, error: fetchError } = await admin
      .from('projects')
      .select('id, organization_id')
      .eq('id', params.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const { data: updated, error: updateError } = await admin
      .from('projects')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select('id, governing_code, governing_code_year, jurisdiction, unit_system, locale, ahj, page_size')
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/projects/[id]/standards]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET — return just the standards fields for a project
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const orgId = caller.organization_id
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projects')
      .select('id, governing_code, governing_code_year, jurisdiction, unit_system, locale, ahj, page_size')
      .eq('id', params.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/projects/[id]/standards]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
