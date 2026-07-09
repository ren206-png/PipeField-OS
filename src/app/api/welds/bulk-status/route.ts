// ============================================================
// POST /api/welds/bulk-status
// Updates status (and optionally notes) for multiple welds in
// one call. Scoped to the caller's organization.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

const schema = z.object({
  weldIds:   z.array(z.string().uuid()).min(1).max(100),
  newStatus: z.string().min(1),
  notes:     z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid payload' },
        { status: 400 }
      )
    }

    const { weldIds, newStatus, notes } = parsed.data
    const admin = createAdminClient()

    const { count, error: updateError } = await admin
      .from('welds')
      .update({
        status: newStatus,
        ...(notes ? { notes } : {}),
      })
      .in('id', weldIds)
      .eq('organization_id', caller.organization_id)

    if (updateError) throw updateError

    // ── Notification side-effects (fire-and-forget per weld) ──
    if (newStatus === 'failed' || newStatus === 'accepted') {
      const { data: weldRows } = await admin
        .from('welds')
        .select('id, weld_id_number')
        .in('id', weldIds)
        .eq('organization_id', caller.organization_id)

      for (const w of weldRows ?? []) {
        const weldNumber = (w.weld_id_number as string | null) ?? w.id
        createNotification({
          organizationId: caller.organization_id,
          type:  newStatus === 'failed' ? 'weld_failed' : 'weld_accepted',
          title: newStatus === 'failed' ? 'Weld Failed' : 'Weld Accepted',
          body:  newStatus === 'failed'
            ? `Weld ${weldNumber} failed inspection`
            : `Weld ${weldNumber} accepted`,
          href: `/welds/${w.id}`,
        }).catch(() => {})
      }
    }

    // Single batch audit log entry
    await admin.from('audit_logs').insert({
      organization_id: caller.organization_id,
      table_name:      'welds',
      record_id:       weldIds[0], // representative record
      action:          'UPDATE',
      new_values:      { status: newStatus, weld_ids: weldIds },
      performed_by:    caller.id,
    })

    return NextResponse.json({ updated: count ?? weldIds.length })
  } catch (err) {
    console.error('POST /api/welds/bulk-status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
