// ============================================================
// GET /api/cron/trial-notifications
// Vercel Cron — fires every day at 08:00 UTC.
//
// For every organization in 'trialing' status, checks which
// notification milestones are due (day 7 / day 11 / day 13)
// and sends:
//   1. An email to the org owner / administrator(s)
//   2. An in-app notification (inserted into `notifications` table)
//
// Idempotency: each milestone key is stored in the
// `trial_notifications_sent` jsonb column on `organizations`.
// A milestone is only sent once, even if the cron fires
// multiple times on the same day.
//
// Auth: CRON_SECRET bearer token (same pattern as other crons).
// Feature gate: PFOS_TRIAL_BILLING must be 'true'.
//
// Error isolation: one org failure does not abort the batch.
// All errors are logged; the route always returns 200 so Vercel
// does not retry with exponential back-off.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTrialNotificationEmail } from '@/lib/email'
import { TRIAL_MILESTONES, type TrialMilestoneKey } from '@/lib/trial-notifications-copy'
import { TRIAL_BILLING_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

// ── Auth helper ───────────────────────────────────────────────
function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ── Days remaining until a date ───────────────────────────────
function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export async function GET(req: NextRequest) {
  // ── Feature gate ───────────────────────────────────────────
  if (!TRIAL_BILLING_ENABLED) {
    return NextResponse.json({ skipped: 'PFOS_TRIAL_BILLING not enabled' }, { status: 200 })
  }

  // ── Cron auth ──────────────────────────────────────────────
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date().toISOString()

  // ── Fetch all trialing orgs whose trial hasn't expired ─────
  const { data: orgs, error: orgsError } = await admin
    .from('organizations')
    .select('id, name, trial_ends_at, trial_notifications_sent')
    .eq('subscription_status', 'trialing')
    .not('trial_ends_at', 'is', null)
    .gt('trial_ends_at', now)           // trial still active

  if (orgsError) {
    console.error('[trial-notifications] failed to fetch orgs:', orgsError)
    return NextResponse.json({ error: 'DB error' }, { status: 200 }) // 200 to avoid Vercel retry
  }

  if (!orgs?.length) {
    return NextResponse.json({ processed: 0, message: 'No trialing orgs' })
  }

  const results: Array<{ org_id: string; sent: string[]; skipped: string[]; error?: string }> = []

  for (const org of orgs) {
    const orgResult: typeof results[0] = { org_id: org.id, sent: [], skipped: [] }

    try {
      const days        = daysUntil(org.trial_ends_at!)
      const sentKeys    = (org.trial_notifications_sent ?? {}) as Record<string, string>

      // ── Determine which milestones are due ─────────────────
      const dueMilestones = TRIAL_MILESTONES.filter(m => {
        // Due when: days remaining ≤ milestone.daysLeft AND not yet sent
        if (sentKeys[m.key]) return false
        return days <= m.daysLeft
      })

      if (!dueMilestones.length) {
        orgResult.skipped.push('no_milestones_due')
        results.push(orgResult)
        continue
      }

      // ── Fetch admin emails for this org ────────────────────
      const { data: admins } = await admin
        .from('user_profiles')
        .select('email, full_name')
        .eq('organization_id', org.id)
        .in('role', ['organization_owner', 'administrator'])

      const adminEmails = (admins ?? [])
        .map((u: { email?: string | null }) => u.email)
        .filter(Boolean) as string[]

      // ── Send each due milestone ────────────────────────────
      for (const milestone of dueMilestones) {
        try {
          // 1. Email (fire-and-forget per recipient)
          if (adminEmails.length) {
            await Promise.all(
              adminEmails.map(email =>
                sendTrialNotificationEmail({
                  to:          email,
                  orgName:     org.name,
                  milestone,
                  trialEndsAt: org.trial_ends_at,
                }).catch(err =>
                  console.error(`[trial-notifications] email failed org=${org.id} to=${email}`, err)
                )
              )
            )
          }

          // 2. In-app notification (org-wide, user_id null = show to all admins)
          await admin.from('notifications').insert({
            organization_id: org.id,
            user_id:         null,           // visible to all users in the org
            type:            'trial_ending',
            title:           milestone.inAppTitle,
            body:            milestone.inAppBody,
            href:            '/settings/billing',
            is_read:         false,
          })

          // 3. Mark milestone as sent (idempotency)
          const updatedSent = { ...sentKeys, [milestone.key]: now }
          await admin
            .from('organizations')
            .update({ trial_notifications_sent: updatedSent })
            .eq('id', org.id)

          orgResult.sent.push(milestone.key)

        } catch (milestoneErr) {
          console.error(
            `[trial-notifications] milestone=${milestone.key} org=${org.id}`,
            milestoneErr
          )
          orgResult.skipped.push(`${milestone.key}_error`)
        }
      }

    } catch (orgErr) {
      console.error(`[trial-notifications] org=${org.id}`, orgErr)
      orgResult.error = String(orgErr)
    }

    results.push(orgResult)
  }

  const totalSent = results.reduce((n, r) => n + r.sent.length, 0)
  console.info(`[trial-notifications] done. orgs=${orgs.length} notifications_sent=${totalSent}`)

  return NextResponse.json({ processed: orgs.length, notifications_sent: totalSent, results })
}
