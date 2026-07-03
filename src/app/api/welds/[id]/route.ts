// ============================================================
// PATCH /api/welds/[id]
// Update a weld's status (and optionally notes). Scoped to the
// caller's organization.
//
// After a weld is set to 'failed', a fire-and-forget check
// runs to detect elevated rejection rates for the welder.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkWelderRejectionRate } from '@/lib/welder-alerts'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

const schema = z.object({
  status: z.string().min(1).optional(),
  notes:  z.string().max(1000).optional().nullable(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid payload' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify the weld exists and belongs to this org
    const { data: existing } = await admin
      .from('welds')
      .select('id, status, welder_id, organization_id, weld_id_number')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Weld not found' }, { status: 404 })
    }

    // Build update payload — only set fields that were provided
    const updatePayload: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status
    if (parsed.data.notes  !== undefined) updatePayload.notes  = parsed.data.notes ?? null

    const { data: updated, error: updateError } = await admin
      .from('welds')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .select()
      .single()

    if (updateError) throw updateError

    // Audit log — non-critical, swallow errors so they don't fail the request
    try {
      await admin.from('audit_logs').insert({
        organization_id: caller.organization_id,
        table_name:      'welds',
        record_id:       id,
        action:          'UPDATE',
        new_values:      updatePayload,
        performed_by:    caller.id,
      })
    } catch { /* non-critical */ }

    // Fire-and-forget rejection rate check when a weld is marked failed
    if (parsed.data.status === 'failed' && existing.welder_id) {
      const welderId      = existing.welder_id as string
      const organizationId = caller.organization_id
      checkWelderRejectionRate({ welderId, organizationId, supabase: admin }).catch(() => {})
    }

    // ── Notification side-effects ──────────────────────────
    const weldNumber = (existing.weld_id_number as string | null) ?? id
    if (parsed.data.status === 'failed') {
      createNotification({
        organizationId: caller.organization_id,
        type:  'weld_failed',
        title: 'Weld Failed',
        body:  `Weld ${weldNumber} failed inspection`,
        href:  `/welds/${id}`,
      }).catch(() => {})
    } else if (parsed.data.status === 'accepted') {
      createNotification({
        organizationId: caller.organization_id,
        type:  'weld_accepted',
        title: 'Weld Accepted',
        body:  `Weld ${weldNumber} accepted`,
        href:  `/welds/${id}`,
      }).catch(() => {})
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/welds/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const admin  = createAdminClient()

    const { data, error } = await admin
      .from('welds')
      .select('*')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/welds/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
