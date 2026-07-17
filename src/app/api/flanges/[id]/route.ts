// ============================================================
// GET    /api/flanges/[id] — single flange
// PATCH  /api/flanges/[id] — update flange
// DELETE /api/flanges/[id] — delete flange
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

const PatchSchema = z.object({
  status:           z.enum(['pending', 'assembled', 'torqued', 'inspected', 'rejected']).optional(),
  notes:            z.string().max(5000).optional().nullable(),
  bolt_torque_spec: z.string().max(500).optional().nullable(),
  gasket_type:      z.string().max(200).optional().nullable(),
  inspector_id:     z.string().uuid().optional().nullable(),
  inspected_at:     z.string().datetime().optional().nullable(),
})

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('flanges')
      .select('*')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Flange not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// ── PATCH ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = PatchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Verify ownership
    const { data: existing } = await admin
      .from('flanges')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Flange not found' }, { status: 404 })

    const updates: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }

    // Auto-set inspected_at and inspector_id when status transitions to 'inspected'
    if (parsed.data.status === 'inspected' && existing.status !== 'inspected') {
      updates.inspected_at = new Date().toISOString()
      updates.inspector_id = caller.id
    }

    const { data, error } = await admin
      .from('flanges')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Flange not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    )
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const admin = createAdminClient()

    // Verify ownership
    const { data: existing } = await admin
      .from('flanges')
      .select('id')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Flange not found' }, { status: 404 })

    const { error } = await admin
      .from('flanges')
      .delete()
      .eq('id', id)
      .eq('organization_id', caller.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    )
  }
}
