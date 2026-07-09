// ============================================================
// PATCH /api/itps/items/[id]
// Update an ITP item's status (and optional fields).
// After marking complete/not_applicable, checks if every item
// on the parent ITP is done and auto-sets completed_at.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
import { z } from 'zod'
import type { ItpItemStatus } from '@/types'

const schema = z.object({
  status:         z.enum(['pending', 'in_progress', 'complete', 'not_applicable']).optional(),
  completed_date: z.string().nullable().optional(),
  completed_by:   z.string().nullable().optional(),
  remarks:        z.string().nullable().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
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
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const orgId = caller.organization_id

    // Verify the item belongs to this org
    const { data: existing } = await admin
      .from('itp_items')
      .select('id, itp_id, organization_id, status')
      .eq('id', id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'ITP item not found' }, { status: 404 })
    }

    // Build update payload
    const updateFields: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.status         !== undefined) updateFields['status']         = parsed.data.status
    if (parsed.data.completed_date !== undefined) updateFields['completed_date'] = parsed.data.completed_date ?? null
    if (parsed.data.completed_by   !== undefined) updateFields['completed_by']   = parsed.data.completed_by   ?? null
    if (parsed.data.remarks        !== undefined) updateFields['remarks']         = parsed.data.remarks        ?? null

    const { data: updated, error: updateError } = await admin
      .from('itp_items')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('ITP item update error:', updateError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // ── Auto-completion check ──────────────────────────────────
    const itpId = existing.itp_id

    // Only bother if this item just became complete or not_applicable
    const newStatus = (parsed.data.status ?? existing.status) as ItpItemStatus
    if (newStatus === 'complete' || newStatus === 'not_applicable') {
      // Fetch the parent ITP to check completed_at
      const { data: itp } = await admin
        .from('itps')
        .select('id, title, itp_number, organization_id, completed_at, project_id')
        .eq('id', itpId)
        .maybeSingle()

      if (itp && !itp.completed_at) {
        // Count all items for this ITP
        const { data: allItems } = await admin
          .from('itp_items')
          .select('id, status')
          .eq('itp_id', itpId)

        const items = allItems ?? []
        const total = items.length
        const done  = items.filter(
          (i: { status: string }) => i.status === 'complete' || i.status === 'not_applicable',
        ).length

        if (total > 0 && done === total) {
          // All items done — stamp completed_at
          const completedAt = new Date().toISOString()
          await admin
            .from('itps')
            .update({ completed_at: completedAt, updated_at: completedAt })
            .eq('id', itpId)

          // Fire notification (fire-and-forget)
          createNotification({
            organizationId: orgId,
            type:           'itp_complete',
            title:          'ITP Complete',
            body:           `ITP ${itp.itp_number} — "${itp.title}" has been fully completed (${total} activities passed).`,
            href:           `/documents/itps/${itpId}`,
          }).catch(console.error)
        }
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('ITP item PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
