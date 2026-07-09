// ============================================================
// GET  /api/welders        — list welders in caller's org
// POST /api/welders        — create a welder (enforces plan limit)
//
// P0-FIX-2: checkWelderLimit() was defined but never called.
// All welder creation now routes through this handler so the
// plan-seat limit is enforced server-side before any DB write.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkWelderLimit } from '@/lib/usage'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  full_name:        z.string().min(1).max(200),
  stamp:            z.string().min(1).max(50),
  email:            z.string().email().nullable().optional(),
  phone:            z.string().max(50).nullable().optional(),
  process:          z.array(z.string()).nullable().optional(),
  position:         z.array(z.string()).nullable().optional(),
  certification_no: z.string().max(100).nullable().optional(),
  cert_expiry:      z.string().nullable().optional(),
  is_active:        z.boolean().optional().default(true),
  notes:            z.string().max(2000).nullable().optional(),
})

// ── GET — list welders ────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('welders')
      .select('*')
      .eq('organization_id', caller.organization_id)
      .order('full_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ welders: data ?? [] })
  } catch (err) {
    console.error('[GET /api/welders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST — create welder (with plan limit check) ──────────────
export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // ── Enforce plan welder limit (P0-FIX-2) ─────────────────
    const limitCheck = await checkWelderLimit(caller.organization_id)
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Welder limit reached. Your ${limitCheck.plan} plan allows ${limitCheck.limit} welder${limitCheck.limit === 1 ? '' : 's'}. Upgrade to add more.`,
          code:    'PLAN_LIMIT_EXCEEDED',
          limit:   limitCheck.limit,
          current: limitCheck.current,
          plan:    limitCheck.plan,
        },
        { status: 403 },
      )
    }

    // ── Validate body ─────────────────────────────────────────
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('welders')
      .insert({
        ...parsed.data,
        organization_id: caller.organization_id,
        created_by:      caller.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ welder: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/welders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
