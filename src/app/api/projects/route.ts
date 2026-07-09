// ============================================================
// POST /api/projects — create a new project
// Enforces per-plan project limits before inserting.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkProjectLimit } from '@/lib/usage'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name:           z.string().min(1).max(200),
  project_number: z.string().max(50).optional().nullable(),
  description:    z.string().max(2000).optional().nullable(),
  client_name:    z.string().max(200).optional().nullable(),
  location:       z.string().max(300).optional().nullable(),
  start_date:     z.string().optional().nullable(),
  end_date:       z.string().optional().nullable(),
  status:         z
    .enum(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
    .default('active'),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const orgId = caller.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // ── Enforce plan limit ──────────────────────────────────
    const limitCheck = await checkProjectLimit(orgId)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Project limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} project${limitCheck.limit === 1 ? '' : 's'}. Upgrade to add more.`,
          code:    'PLAN_LIMIT_EXCEEDED',
          limit:   limitCheck.limit,
          current: limitCheck.current,
          plan:    limitCheck.plan,
        },
        { status: 403 },
      )
    }

    // ── Validate body ────────────────────────────────────────
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const values = parsed.data
    const admin  = createAdminClient()

    const { data, error: insertErr } = await admin
      .from('projects')
      .insert({
        organization_id: orgId,
        name:            values.name,
        project_number:  values.project_number  ?? null,
        description:     values.description     ?? null,
        client_name:     values.client_name     ?? null,
        location:        values.location        ?? null,
        start_date:      values.start_date      ?? null,
        end_date:        values.end_date        ?? null,
        status:          values.status,
        created_by:      caller.id,
      })
      .select('id, name, status, created_at')
      .single()

    if (insertErr) throw insertErr

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
