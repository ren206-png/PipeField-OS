// ============================================================
// POST /api/notifications/weld-status
// Sends an email to the welder when their weld's status changes
// to a noteworthy state (accepted, failed, fit_up_approved, visual_pass).
//
// Called fire-and-forget from the client after a status update.
// Failures are logged but never surface to the user.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWeldStatusEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Only send emails for these status transitions — don't spam on every change
const NOTIFY_ON: string[] = ['accepted', 'failed', 'fit_up_approved', 'visual_pass']

const schema = z.object({
  weldId:    z.string().uuid(),
  oldStatus: z.string(),
  newStatus: z.string(),
  notes:     z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { weldId, oldStatus, newStatus, notes } = parsed.data

    // Only send for notable statuses
    if (!NOTIFY_ON.includes(newStatus)) {
      return NextResponse.json({ skipped: true })
    }

    const admin = createAdminClient()

    // Get the weld — scoped to caller's org to prevent cross-org notification abuse
    const { data: weld } = await admin
      .from('welds')
      .select('weld_id_number, welder_name, welder_stamp, organization_id, project_id')
      .eq('id', weldId)
      .eq('organization_id', caller.organization_id!)
      .maybeSingle()

    if (!weld) return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

    // Find the welder's profile by name match within the org (best-effort)
    const { data: welderProfile } = await admin
      .from('user_profiles')
      .select('email, full_name')
      .eq('organization_id', weld.organization_id)
      .ilike('full_name', `%${weld.welder_name ?? ''}%`)
      .maybeSingle()

    // Also notify the org admins + project managers
    const { data: admins } = await admin
      .from('user_profiles')
      .select('email, full_name')
      .eq('organization_id', weld.organization_id)
      .in('role', ['administrator', 'organization_owner', 'project_manager', 'foreman'])
      .eq('is_active', true)

    // Get the name of the person who made the change
    const { data: changedBy } = await admin
      .from('user_profiles')
      .select('full_name')
      .eq('id', caller.id)
      .maybeSingle()

    const changedByName = changedBy?.full_name ?? 'A team member'
    const weldNumber    = weld.weld_id_number ?? weldId.slice(0, 8)

    // Build recipient list (dedup)
    const recipients = new Set<string>()
    if (welderProfile?.email) recipients.add(welderProfile.email)
    admins?.forEach(a => { if (a.email) recipients.add(a.email) })

    // Send to all recipients in parallel (fire and forget — errors are caught)
    await Promise.allSettled(
      Array.from(recipients).map(email =>
        sendWeldStatusEmail({
          to:           email,
          welderName:   welderProfile?.full_name ?? weld.welder_name ?? 'Team',
          weldNumber,
          oldStatus,
          newStatus,
          weldId,
          notes,
          changedByName,
        })
      )
    )

    return NextResponse.json({ sent: recipients.size })

  } catch (err) {
    // Never let email failures surface to the user
    console.error('[/api/notifications/weld-status]', err)
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 })
  }
}
