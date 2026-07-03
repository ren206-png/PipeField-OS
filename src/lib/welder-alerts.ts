// ============================================================
// Welder Rejection Rate Alert
// Called fire-and-forget after a weld is set to 'failed'.
// Checks if the welder's 90-day rejection rate exceeds 10%
// and sends an alert email + in-app notification to QC managers.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { getResend } from '@/lib/email'
import { createNotification } from '@/lib/notifications'

const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'
const FROM           = process.env.EMAIL_FROM ?? 'PipeField OS <onboarding@resend.dev>'
const WINDOW_DAYS    = 90
const MIN_WELDS      = 5          // Minimum welds before we alert (avoid false alarms)
const ALERT_THRESHOLD = 0.10     // 10 %
const SPAM_GUARD_DAYS = 7        // Don't re-alert within 7 days for the same welder

// ── HTML escape ───────────────────────────────────────────────
function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ── Main exported function ────────────────────────────────────
export async function checkWelderRejectionRate({
  welderId,
  organizationId,
  supabase,
}: {
  welderId:       string
  organizationId: string
  supabase:       SupabaseClient
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS)
  const cutoffIso = cutoff.toISOString()

  // 1. Fetch welder profile for their name
  const { data: welder } = await supabase
    .from('welders')
    .select('id, full_name, stamp')
    .eq('id', welderId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!welder) return // Welder not found — nothing to do

  // 2. Count total welds in last 90 days for this welder
  const { count: total } = await supabase
    .from('welds')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('welder_id', welderId)
    .gte('created_at', cutoffIso)

  if (!total || total < MIN_WELDS) return // Not enough data yet

  // 3. Count failed welds in last 90 days
  const { count: failed } = await supabase
    .from('welds')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('welder_id', welderId)
    .eq('status', 'failed')
    .gte('created_at', cutoffIso)

  const failedCount = failed ?? 0
  const rate        = failedCount / total

  // 4. Only proceed if threshold exceeded
  if (rate <= ALERT_THRESHOLD) return

  // 5. Spam guard — skip if we already sent an alert for this welder in the last 7 days
  const spamCutoff = new Date()
  spamCutoff.setDate(spamCutoff.getDate() - SPAM_GUARD_DAYS)
  // Spec: look for a notification with type='welder_alert' and body containing welderId
  // The notifications table uses a 'body' column for the message content.
  const { data: recentAlert } = await supabase
    .from('notifications')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('type', 'welder_alert')
    .ilike('body', `%${welderId}%`)
    .gte('created_at', spamCutoff.toISOString())
    .maybeSingle()

  if (recentAlert) return // Already alerted recently — skip

  const ratePercent = Math.round(rate * 100)
  const welderName  = welder.full_name
  const subject     = `⚠️ Welder Alert — ${welderName} rejection rate at ${ratePercent}%`

  // 6. Get all QC managers and admins in the org
  const { data: managers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('organization_id', organizationId)
    .in('role', ['qc_manager', 'administrator', 'organization_owner', 'qa_inspector'])
    .eq('is_active', true)

  if (!managers || managers.length === 0) return

  const notificationBody =
    `Welder ${welderName} (ID: ${welderId}) has a rejection rate of ${ratePercent}% ` +
    `over the last ${WINDOW_DAYS} days (${failedCount} failed out of ${total} total welds).`

  // 7a. Insert in-app notifications for each manager
  await Promise.allSettled(
    managers.map(m =>
      createNotification({
        organizationId,
        userId: m.id,
        type:   'welder_alert',
        title:  subject,
        body:   notificationBody,
        href:   `/welders`,
      })
    )
  )

  // 7b. Send email alerts via Resend
  const html = buildAlertEmail({
    welderName,
    welderId,
    ratePercent,
    total,
    failedCount,
  })

  const emailRecipients = managers
    .map(m => m.email)
    .filter((e): e is string => !!e)

  await Promise.allSettled(
    emailRecipients.map(to =>
      getResend().emails.send({ from: FROM, to, subject, html })
    )
  )
}

// ── Email template ────────────────────────────────────────────
function buildAlertEmail({
  welderName,
  welderId,
  ratePercent,
  total,
  failedCount,
}: {
  welderName:   string
  welderId:     string
  ratePercent:  number
  total:        number
  failedCount:  number
}): string {
  const welderProfileUrl = `${APP_URL}/welders`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:540px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">

    <!-- Header -->
    <div style="background:#f9731615;border-bottom:2px solid #f9731640;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;background:#f9731625;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;">
          ⚠️
        </div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">PipeField OS — Quality Alert</p>
          <h1 style="margin:4px 0 0;font-size:19px;font-weight:700;color:#f9fafb;">Welder Rejection Rate Alert</h1>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:15px;color:#d1d5db;">
        Welder <strong style="color:#f9fafb;">${esc(welderName)}</strong> has exceeded the
        rejection rate threshold over the last 90 days.
      </p>

      <!-- Rate badge -->
      <div style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;padding:12px 32px;background:#ef444420;border:2px solid #ef444450;border-radius:12px;font-size:36px;font-weight:800;color:#ef4444;">
          ${ratePercent}%
        </span>
        <p style="margin:8px 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Rejection Rate (90 days)</p>
      </div>

      <!-- Stats table -->
      <div style="background:#111318;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2d3a;">
        <p style="margin:0 0 14px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Statistics — Last 90 Days</p>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr style="border-bottom:1px solid #1f2232;">
              <td style="padding:10px 0;font-size:13px;color:#9ca3af;">Total Welds</td>
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#f9fafb;text-align:right;">${total}</td>
            </tr>
            <tr style="border-bottom:1px solid #1f2232;">
              <td style="padding:10px 0;font-size:13px;color:#9ca3af;">Failed Welds</td>
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#ef4444;text-align:right;">${failedCount}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:13px;color:#9ca3af;">Rejection Rate</td>
              <td style="padding:10px 0;font-size:14px;font-weight:700;color:#f97316;text-align:right;">${ratePercent}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recommendation -->
      <div style="background:#f9731610;border-left:3px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#d1d5db;line-height:1.6;">
          <strong style="color:#f9fafb;">Recommendation:</strong>
          Consider reviewing this welder's technique or assigning additional QA oversight.
          A rejection rate above 10% may indicate issues with electrode handling, fit-up
          procedures, or technique drift.
        </p>
      </div>

      <!-- CTA -->
      <a href="${esc(welderProfileUrl)}"
         style="display:block;text-align:center;background:#f97316;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:28px;">
        View Welder Profile →
      </a>

      <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
        PipeField OS · <a href="${APP_URL}" style="color:#6b7280;">pipefield-os.com</a>
        &nbsp;·&nbsp; This alert will not repeat for 7 days.
      </p>
    </div>
  </div>
</body>
</html>`
}
