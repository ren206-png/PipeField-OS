// ============================================================
// GET /api/cron/daily-digest
// Vercel Cron — fires every day at 06:00 UTC.
// Sends a daily field activity digest to all project_manager,
// qc_manager, and admin users in each active organisation.
//
// Auth: Bearer token via CRON_SECRET env var.
// Supabase: uses service role key (bypasses RLS).
// Email: uses Resend via src/lib/email.ts getResend().
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, sendCertExpiryEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// ── Types ────────────────────────────────────────────────────

interface OrgRow {
  id:   string
  name: string
}

interface UserProfileRow {
  id:    string
  email: string
  full_name: string | null
  role:  string
}

interface DigestStats {
  weldsAccepted:  number
  weldsFailed:    number
  pendingNde:     number
  openRfis:       number
  openNcrs:       number
}

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

// ── Email template ────────────────────────────────────────────

function buildDigestHtml({
  orgName,
  dateLabel,
  stats,
  appUrl,
}: {
  orgName:   string
  dateLabel: string
  stats:     DigestStats
  appUrl:    string
}): string {
  const { weldsAccepted, weldsFailed, pendingNde, openRfis, openNcrs } = stats

  // Conditional colours
  const failuresColor = weldsFailed > 0  ? '#ef4444' : '#22c55e'
  const ncrsColor     = openNcrs    > 0  ? '#f97316' : '#6b7280'

  function statBox(
    emoji: string,
    label: string,
    value: number,
    valueColor: string,
  ): string {
    return `
      <div style="background:#111318;border-radius:12px;padding:18px 20px;border:1px solid #2a2d3a;flex:1;min-width:130px;">
        <p style="margin:0 0 6px;font-size:20px;">${emoji}</p>
        <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">${esc(label)}</p>
        <p style="margin:0;font-size:28px;font-weight:800;color:${valueColor};font-family:monospace;">${value}</p>
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Daily Field Report — ${esc(orgName)}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">

    <!-- Header -->
    <div style="background:#f9731615;border-bottom:2px solid #f9731640;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:44px;height:44px;background:#f9731625;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:22px;text-align:center;line-height:44px;">
          🔧
        </div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">PipeField OS</p>
          <h1 style="margin:3px 0 0;font-size:19px;font-weight:800;color:#f9fafb;">Daily Field Report</h1>
        </div>
      </div>
      <div style="margin-top:18px;padding-top:18px;border-top:1px solid #2a2d3a30;">
        <p style="margin:0;font-size:14px;color:#9ca3af;">
          <strong style="color:#d1d5db;">${esc(orgName)}</strong>
          &nbsp;·&nbsp;
          ${esc(dateLabel)}
        </p>
      </div>
    </div>

    <!-- Stats grid -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;font-weight:700;">
        Yesterday's Activity
      </p>

      <!-- Row 1 -->
      <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        ${statBox('✅', 'Welds Accepted', weldsAccepted, '#22c55e')}
        ${statBox('❌', 'Weld Failures',  weldsFailed,  failuresColor)}
        ${statBox('🔬', 'Pending NDE',    pendingNde,   '#6366f1')}
      </div>

      <!-- Row 2 -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${statBox('📋', 'Open RFIs', openRfis, '#3b82f6')}
        ${statBox('⚠️', 'Open NCRs', openNcrs, ncrsColor)}
      </div>

      <!-- Separator -->
      <div style="border-top:1px solid #2a2d3a;margin:28px 0;"></div>

      <!-- CTA button -->
      <a href="${esc(appUrl)}/dashboard"
         style="display:block;text-align:center;background:#f97316;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:11px;font-size:15px;font-weight:700;letter-spacing:0.01em;">
        View Dashboard →
      </a>

      <!-- Footer -->
      <p style="margin:24px 0 0;font-size:12px;color:#4b5563;text-align:center;line-height:1.6;">
        You're receiving this because you're a manager or admin in PipeField OS.<br>
        Manage notifications in
        <a href="${esc(appUrl)}/organization" style="color:#6b7280;text-decoration:underline;">Settings</a>.
      </p>
    </div>

  </div>
</body>
</html>`
}

// ── Per-org processing ────────────────────────────────────────

async function processOrg(
  org: OrgRow,
  yesterday: string,
  now: string,
  appUrl: string,
): Promise<{ orgId: string; emailsSent: number }> {
  const admin = createAdminClient()

  // Run all stat queries in parallel
  const [
    weldsAcceptedResult,
    weldsFailedResult,
    pendingNdeResult,
    openRfisResult,
    openNcrsResult,
    usersResult,
  ] = await Promise.all([
    // Welds accepted yesterday
    admin
      .from('welds')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'accepted')
      .gte('updated_at', yesterday)
      .lt('updated_at', now),

    // Weld failures yesterday
    admin
      .from('welds')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'failed')
      .gte('updated_at', yesterday)
      .lt('updated_at', now),

    // All pending NDE (xray_pending) — not time-bounded, it's a standing count
    admin
      .from('welds')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .eq('status', 'xray_pending'),

    // Open RFIs
    admin
      .from('rfis')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .neq('status', 'closed'),

    // Open NCRs
    admin
      .from('ncrs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .neq('status', 'closed'),

    // Managers / admins to notify
    admin
      .from('user_profiles')
      .select('id, email, full_name, role')
      .eq('org_id', org.id)
      .in('role', ['project_manager', 'qc_manager', 'admin'])
      .eq('status', 'active'),
  ])

  const stats: DigestStats = {
    weldsAccepted: weldsAcceptedResult.count ?? 0,
    weldsFailed:   weldsFailedResult.count   ?? 0,
    pendingNde:    pendingNdeResult.count     ?? 0,
    openRfis:      openRfisResult.count       ?? 0,
    openNcrs:      openNcrsResult.count       ?? 0,
  }

  // Skip org if there was zero activity yesterday
  const hadActivity = stats.weldsAccepted > 0 || stats.weldsFailed > 0
  if (!hadActivity) {
    return { orgId: org.id, emailsSent: 0 }
  }

  const users: UserProfileRow[] = usersResult.data ?? []
  if (users.length === 0) {
    return { orgId: org.id, emailsSent: 0 }
  }

  const dateLabel = new Date(yesterday).toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    timeZone: 'UTC',
  })

  const subject = `Daily Field Report — ${org.name} — ${dateLabel}`
  const html    = buildDigestHtml({ orgName: org.name, dateLabel, stats, appUrl })
  const resend  = getResend()
  const FROM    = process.env.EMAIL_FROM ?? 'PipeField OS <onboarding@resend.dev>'

  // Send emails in parallel
  await Promise.allSettled(
    users.map((user) =>
      resend.emails.send({
        from:    FROM,
        to:      user.email,
        subject,
        html,
      }).catch((err: unknown) => {
        console.error(`[daily-digest] Failed to send to ${user.email} (org ${org.id}):`, err)
      }),
    ),
  )

  // ── Cert expiry alerts ──────────────────────────────────────
  // Query welders expiring within 30 days (or already expired)
  const thirtyDaysFromNow = new Date(new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000)
  const { data: expiringRows } = await admin
    .from('welders')
    .select('id, name, stamp, cert_expiry')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .lte('cert_expiry', thirtyDaysFromNow.toISOString().split('T')[0])

  if (expiringRows && expiringRows.length > 0) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const expiringWelders = expiringRows.map((w) => {
      const expiry    = new Date(w.cert_expiry)
      const daysLeft  = Math.floor((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      return {
        name:       w.name ?? '',
        stamp:      w.stamp ?? '',
        certExpiry: w.cert_expiry ?? '',
        daysLeft,
      }
    })

    const adminEmails = users.map((u) => u.email)
    await sendCertExpiryEmail({
      to:      adminEmails,
      orgName: org.name,
      expiringWelders,
    }).catch((err: unknown) => {
      console.error(`[daily-digest] Failed to send cert expiry alert for org ${org.id}:`, err)
    })
  }

  return { orgId: org.id, emailsSent: users.length }
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Verify cron secret
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'

  // 2. Build 24-hour window (yesterday UTC)
  const now       = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const nowIso       = now.toISOString()
  const yesterdayIso = yesterday.toISOString()

  // 3. Get all organisations
  const admin = createAdminClient()
  const { data: orgs, error: orgsError } = await admin
    .from('organizations')
    .select('id, name')

  if (orgsError) {
    console.error('[daily-digest] Failed to fetch organizations:', orgsError)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: 'No organizations found', sent: 0 })
  }

  // 4. Process each org — resilient: one org failing won't kill the rest
  const results = await Promise.allSettled(
    (orgs as OrgRow[]).map((org) =>
      processOrg(org, yesterdayIso, nowIso, appUrl),
    ),
  )

  // 5. Summarise results
  let totalSent    = 0
  let totalSkipped = 0
  let totalErrors  = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalSent    += result.value.emailsSent
      totalSkipped += result.value.emailsSent === 0 ? 1 : 0
    } else {
      totalErrors++
      console.error('[daily-digest] Org processing error:', result.reason)
    }
  }

  console.warn(`[daily-digest] Done. sent=${totalSent} skipped=${totalSkipped} errors=${totalErrors}`)

  return NextResponse.json({
    message:  'Daily digest complete',
    orgsTotal:    orgs.length,
    emailsSent:   totalSent,
    orgsSkipped:  totalSkipped,
    orgsFailed:   totalErrors,
  })
}
