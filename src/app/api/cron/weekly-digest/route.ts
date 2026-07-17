// ============================================================
// GET /api/cron/weekly-digest
// Vercel Cron — fires every Monday at 07:00 UTC.
// Same logic as daily-digest but:
//   • Looks at the past 7 days instead of 24h
//   • Only sends to users where digest_frequency = 'weekly'
// Auth: Bearer token via CRON_SECRET env var.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/email'

export const dynamic = 'force-dynamic'

interface OrgRow   { id: string; name: string }
interface UserRow  { id: string; email: string; full_name: string | null; role: string }

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function buildWeeklyHtml({
  orgName, weekLabel, weldsAccepted, weldsFailed, pendingNde, openRfis, openNcrs, appUrl,
}: {
  orgName: string; weekLabel: string
  weldsAccepted: number; weldsFailed: number; pendingNde: number
  openRfis: number; openNcrs: number; appUrl: string
}): string {
  const passRate = weldsAccepted + weldsFailed > 0
    ? Math.round((weldsAccepted / (weldsAccepted + weldsFailed)) * 100)
    : null

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Weekly Field Digest — ${esc(orgName)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0f172a;border-radius:12px;padding:28px 32px;margin-bottom:24px;">
    <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">PipeField OS</p>
    <h1 style="margin:0 0 4px;color:#f97316;font-size:22px;font-weight:700;">Weekly Field Digest</h1>
    <p style="margin:0;color:#94a3b8;font-size:14px;">${esc(orgName)} · ${esc(weekLabel)}</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">Welds Accepted</p>
      <p style="margin:0;color:#059669;font-size:28px;font-weight:700;">${weldsAccepted}</p>
      ${passRate !== null ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${passRate}% pass rate</p>` : ''}
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">Welds Failed</p>
      <p style="margin:0;color:${weldsFailed > 0 ? '#dc2626' : '#64748b'};font-size:28px;font-weight:700;">${weldsFailed}</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">NDE Pending</p>
      <p style="margin:0;color:#d97706;font-size:28px;font-weight:700;">${pendingNde}</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;">Open RFIs / NCRs</p>
      <p style="margin:0;color:${openRfis + openNcrs > 0 ? '#dc2626' : '#64748b'};font-size:28px;font-weight:700;">${openRfis + openNcrs}</p>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:32px;">
    <a href="${appUrl}/dashboard" style="display:inline-block;padding:12px 28px;background:#f97316;color:#fff;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;">View Dashboard →</a>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:11px;">
    You receive this weekly because your digest is set to Weekly.<br>
    <a href="${appUrl}/settings" style="color:#64748b;">Change preferences</a>
  </p>
</div></body></html>`
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin   = createAdminClient()
  const resend  = getResend()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'

  // 7-day window
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Load all active orgs
  const { data: orgs } = await admin
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)

  if (!orgs?.length) return NextResponse.json({ processed: 0 })

  let processed = 0; let emails = 0; let errors = 0

  for (const org of orgs as OrgRow[]) {
    try {
      const [weldsAccepted, weldsFailed, pendingNde, rfis, ncrs, users] = await Promise.all([
        admin.from('welds').select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id).eq('status', 'accepted').gte('updated_at', since),
        admin.from('welds').select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id).in('status', ['nde_fail', 'rejected']).gte('updated_at', since),
        admin.from('welds').select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id).eq('status', 'nde_pending'),
        admin.from('rfis').select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id).not('status', 'in', '("answered","closed","void")'),
        admin.from('ncrs').select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id).not('status', 'in', '("closed","void")'),
        admin.from('user_profiles').select('id, email, full_name, role')
          .eq('organization_id', org.id)
          .in('role', ['project_manager', 'qc_manager', 'administrator', 'organization_owner'])
          .eq('status', 'active')
          .eq('digest_frequency', 'weekly'),
      ])

      const recipients = (users.data ?? []) as UserRow[]
      if (!recipients.length) continue

      const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

      for (const user of recipients) {
        try {
          await resend.emails.send({
            from:    'PipeField OS <digest@pipefield-os.com>',
            to:      user.email,
            subject: `Weekly digest — ${org.name}`,
            html:    buildWeeklyHtml({
              orgName: org.name, weekLabel,
              weldsAccepted: weldsAccepted.count ?? 0,
              weldsFailed:   weldsFailed.count   ?? 0,
              pendingNde:    pendingNde.count     ?? 0,
              openRfis:      rfis.count           ?? 0,
              openNcrs:      ncrs.count           ?? 0,
              appUrl,
            }),
          })
          emails++
        } catch { errors++ }
      }
      processed++
    } catch { errors++ }
  }

  return NextResponse.json({ processed, emails, errors })
}
