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
import { sendWeldStatusEmail } from '@/lib/email'
import { autoReleaseSpoolIfComplete } from '@/lib/spool-auto-release'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  status:              z.string().min(1).optional(),
  notes:               z.string().max(1000).optional().nullable(),
  // Module 3: Material Traceability fields
  base_metal_heat_a:   z.string().max(100).optional().nullable(),
  base_metal_heat_b:   z.string().max(100).optional().nullable(),
  filler_batch_number: z.string().max(100).optional().nullable(),
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
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Verify the weld exists and belongs to this org
    const { data: existing, error: existingError } = await admin
      .from('welds')
      .select('id, status, welder_id, organization_id, weld_id_number')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (!existing) {
      return NextResponse.json({ error: 'Weld not found' }, { status: 404 })
    }

    // Build update payload — only set fields that were provided
    const updatePayload: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.status              !== undefined) updatePayload.status              = parsed.data.status ?? null
    if (parsed.data.notes               !== undefined) updatePayload.notes               = parsed.data.notes  ?? null
    if (parsed.data.base_metal_heat_a   !== undefined) updatePayload.base_metal_heat_a   = parsed.data.base_metal_heat_a   ?? null
    if (parsed.data.base_metal_heat_b   !== undefined) updatePayload.base_metal_heat_b   = parsed.data.base_metal_heat_b   ?? null
    if (parsed.data.filler_batch_number !== undefined) updatePayload.filler_batch_number = parsed.data.filler_batch_number ?? null

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
    } catch (e) { console.warn('[welds/[id]] side-effect failed:', e) }

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

      // Email: welder + org admins/PMs
      if (existing.welder_id) {
        ;(async () => {
          try {
            const emailAdmin = createAdminClient()

            // Welder profile
            const { data: welderProfile } = await emailAdmin
              .from('user_profiles')
              .select('full_name, email')
              .eq('id', existing.welder_id as string)
              .maybeSingle()

            // Org admin/PM emails
            const { data: adminProfiles } = await emailAdmin
              .from('user_profiles')
              .select('email')
              .eq('organization_id', caller.organization_id)
              .in('role', ['organization_owner', 'administrator', 'project_manager'])

            const recipients = [
              welderProfile?.email,
              ...(adminProfiles ?? []).map((p: { email: string }) => p.email),
            ].filter((e): e is string => Boolean(e))

            if (recipients.length > 0) {
              await sendWeldStatusEmail({
                to:            recipients[0] as string,
                welderName:    welderProfile?.full_name ?? 'Unknown',
                weldNumber,
                oldStatus:     existing.status as string,
                newStatus:     'failed',
                weldId:        id,
                notes:         parsed.data.notes ?? null,
                changedByName: caller.full_name ?? 'Inspector',
              })
              // Send to remaining recipients individually
              for (const email of recipients.slice(1)) {
                await sendWeldStatusEmail({
                  to:            email,
                  welderName:    welderProfile?.full_name ?? 'Unknown',
                  weldNumber,
                  oldStatus:     existing.status as string,
                  newStatus:     'failed',
                  weldId:        id,
                  notes:         parsed.data.notes ?? null,
                  changedByName: caller.full_name ?? 'Inspector',
                })
              }
            }
          } catch (e) { console.warn('[welds/[id]] side-effect failed:', e) }
        })()
      }
    } else if (parsed.data.status === 'accepted') {
      createNotification({
        organizationId: caller.organization_id,
        type:  'weld_accepted',
        title: 'Weld Accepted',
        body:  `Weld ${weldNumber} accepted`,
        href:  `/welds/${id}`,
      }).catch(() => {})

      // Email: welder + org admins/PMs
      if (existing.welder_id) {
        ;(async () => {
          try {
            const emailAdmin = createAdminClient()

            const { data: welderProfile } = await emailAdmin
              .from('user_profiles')
              .select('full_name, email')
              .eq('id', existing.welder_id as string)
              .maybeSingle()

            const { data: adminProfiles } = await emailAdmin
              .from('user_profiles')
              .select('email')
              .eq('organization_id', caller.organization_id)
              .in('role', ['organization_owner', 'administrator', 'project_manager'])

            const recipients = [
              welderProfile?.email,
              ...(adminProfiles ?? []).map((p: { email: string }) => p.email),
            ].filter((e): e is string => Boolean(e))

            if (recipients.length > 0) {
              await sendWeldStatusEmail({
                to:            recipients[0] as string,
                welderName:    welderProfile?.full_name ?? 'Unknown',
                weldNumber,
                oldStatus:     existing.status as string,
                newStatus:     'accepted',
                weldId:        id,
                notes:         parsed.data.notes ?? null,
                changedByName: caller.full_name ?? 'Inspector',
              })
              for (const email of recipients.slice(1)) {
                await sendWeldStatusEmail({
                  to:            email,
                  welderName:    welderProfile?.full_name ?? 'Unknown',
                  weldNumber,
                  oldStatus:     existing.status as string,
                  newStatus:     'accepted',
                  weldId:        id,
                  notes:         parsed.data.notes ?? null,
                  changedByName: caller.full_name ?? 'Inspector',
                })
              }
            }
          } catch (e) { console.warn('[welds/[id]] side-effect failed:', e) }
        })()
      }

      // ── Spool auto-release check ───────────────────────────────
      // If this weld belongs to a spool, check if all welds on that
      // spool are now accepted. If so, auto-release the spool.
      autoReleaseSpoolIfComplete({ weldId: id, orgId: caller.organization_id, admin }).catch(() => {})
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/welds/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
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
