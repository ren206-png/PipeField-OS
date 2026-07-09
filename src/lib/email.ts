// ============================================================
// PipeField OS — Email (Resend)
// All transactional emails go through this module.
//
// Setup:
//   1. Create a free account at resend.com
//   2. Add your domain (or use onboarding@resend.dev for testing)
//   3. Set RESEND_API_KEY in Vercel environment variables
//
// The client is created lazily so a missing key throws at
// request time with a clear message, not at build time.
// ============================================================
import { Resend } from 'resend'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('[PipeField OS] RESEND_API_KEY is not set.')
  _resend = new Resend(key)
  return _resend
}

// FROM address — change to your verified domain once set up in Resend
const FROM    = process.env.EMAIL_FROM ?? 'PipeField OS <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'

// ── HTML escape — prevents XSS/injection in email templates ──
function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ── Weld status changed ───────────────────────────────────────

export async function sendWeldStatusEmail({
  to,
  welderName,
  weldNumber,
  oldStatus,
  newStatus,
  weldId,
  notes,
  changedByName,
}: {
  to:           string
  welderName:   string
  weldNumber:   string
  oldStatus:    string
  newStatus:    string
  weldId:       string
  notes?:       string | null
  changedByName: string
}) {
  const statusLabels: Record<string, string> = {
    draft:           'Draft',
    fit_up_approved: 'Fit-Up Approved',
    welded:          'Welded',
    visual_pass:     'Visual Pass',
    xray_pending:    'X-Ray Pending',
    accepted:        '✅ Accepted',
    failed:          '❌ Failed',
    repaired:        'Repaired',
  }

  const isGood = newStatus === 'accepted' || newStatus === 'visual_pass' || newStatus === 'fit_up_approved'
  const isBad  = newStatus === 'failed'

  const subject = isBad
    ? `⚠️ Weld ${weldNumber} Failed Inspection`
    : newStatus === 'accepted'
      ? `✅ Weld ${weldNumber} Accepted`
      : `Weld ${weldNumber} — Status Update`

  const accentColor = isBad ? '#ef4444' : isGood ? '#22c55e' : '#f59e0b'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">
    <!-- Header -->
    <div style="background:${accentColor}15;border-bottom:2px solid ${accentColor}40;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:${accentColor}20;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">
          ${isBad ? '⚠️' : isGood ? '✅' : '🔧'}
        </div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">PipeField OS</p>
          <h1 style="margin:4px 0 0;font-size:18px;font-weight:700;color:#f9fafb;">Weld Status Update</h1>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#9ca3af;font-size:15px;">Hi ${esc(welderName)},</p>

      <div style="background:#111318;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2d3a;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Weld #</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#f9fafb;font-family:monospace;">${esc(weldNumber)}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">New Status</p>
            <span style="display:inline-block;padding:4px 10px;background:${accentColor}20;color:${accentColor};border-radius:6px;font-size:13px;font-weight:600;">
              ${esc(statusLabels[newStatus] ?? newStatus)}
            </span>
          </div>
          <div>
            <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Previous Status</p>
            <p style="margin:0;font-size:14px;color:#9ca3af;">${esc(statusLabels[oldStatus] ?? oldStatus)}</p>
          </div>
          <div>
            <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Updated By</p>
            <p style="margin:0;font-size:14px;color:#9ca3af;">${esc(changedByName)}</p>
          </div>
        </div>

        ${notes ? `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #2a2d3a;">
          <p style="margin:0 0 6px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Inspector Notes</p>
          <p style="margin:0;font-size:14px;color:#d1d5db;line-height:1.6;">${esc(notes)}</p>
        </div>` : ''}
      </div>

      <a href="${APP_URL}/welds/${esc(weldId)}"
         style="display:block;text-align:center;background:${accentColor};color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:24px;">
        View Weld Details →
      </a>

      <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
        PipeField OS · <a href="${APP_URL}" style="color:#6b7280;">pipefield-os.com</a>
      </p>
    </div>
  </div>
</body>
</html>`

  return getResend().emails.send({ from: FROM, to, subject, html })
}

// ── Daily report submitted ────────────────────────────────────

export async function sendDailyReportEmail({
  to,
  reporterName,
  projectName,
  reportDate,
  reportId,
  summaryLine,
}: {
  to:           string
  reporterName: string
  projectName:  string
  reportDate:   string
  reportId:     string
  summaryLine:  string
}) {
  const subject = `📋 Daily Report Submitted — ${esc(projectName)} (${esc(reportDate)})`

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">
    <div style="background:#6366f115;border-bottom:2px solid #6366f140;padding:24px 32px;">
      <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">PipeField OS</p>
      <h1 style="margin:6px 0 0;font-size:18px;font-weight:700;color:#f9fafb;">Daily Report Submitted</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px;color:#9ca3af;font-size:15px;">A new daily field report has been submitted.</p>
      <div style="background:#111318;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2d3a;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">📁 <strong style="color:#d1d5db;">${esc(projectName)}</strong></p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">📅 <strong style="color:#d1d5db;">${esc(reportDate)}</strong></p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">👷 Submitted by <strong style="color:#d1d5db;">${esc(reporterName)}</strong></p>
        <p style="margin:12px 0 0;font-size:14px;color:#9ca3af;line-height:1.6;">${esc(summaryLine)}</p>
      </div>
      <a href="${APP_URL}/daily-reports/${esc(reportId)}"
         style="display:block;text-align:center;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:24px;">
        View Report →
      </a>
      <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">PipeField OS · <a href="${APP_URL}" style="color:#6b7280;">pipefield-os.com</a></p>
    </div>
  </div>
</body>
</html>`

  return getResend().emails.send({ from: FROM, to, subject, html })
}

// ── Share link viewed ─────────────────────────────────────────

export async function sendShareViewEmail({
  to,
  projectName,
  shareLabel,
  viewedAt,
}: {
  to:          string
  projectName: string
  shareLabel:  string
  viewedAt:    string
}) {
  const subject = `👁 Your share link was viewed — ${esc(projectName)}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">
    <div style="background:#f9731615;border-bottom:2px solid #f9731640;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:#f9731620;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">👁</div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">PipeField OS</p>
          <h1 style="margin:4px 0 0;font-size:18px;font-weight:700;color:#f9fafb;">Share Link Viewed</h1>
        </div>
      </div>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px;color:#9ca3af;font-size:15px;">
        Someone just viewed your client share link for <strong style="color:#d1d5db;">${esc(projectName)}</strong>.
      </p>
      <div style="background:#111318;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2d3a;">
        <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Link Label</p>
        <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#f9fafb;">${esc(shareLabel || 'Share link')}</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Viewed at: ${esc(viewedAt)}</p>
      </div>
      <a href="${APP_URL}/dashboard"
         style="display:block;text-align:center;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:24px;">
        View Project →
      </a>
      <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
        PipeField OS · <a href="${APP_URL}" style="color:#6b7280;">pipefield-os.com</a>
      </p>
    </div>
  </div>
</body>
</html>`

  return getResend().emails.send({ from: FROM, to, subject, html })
}

// ── Welder cert expiry alert ──────────────────────────────────

export async function sendCertExpiryEmail({
  to,
  orgName,
  expiringWelders,
}: {
  to: string[]
  orgName: string
  expiringWelders: Array<{ name: string; stamp: string; certExpiry: string; daysLeft: number }>
}): Promise<void> {
  if (!to.length || !expiringWelders.length) return
  const resend = getResend()

  const rows = expiringWelders.map(w => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#e2e8f0;">${esc(w.name)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#94a3b8;font-family:monospace;">${esc(w.stamp)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#94a3b8;">${esc(w.certExpiry)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e293b;font-weight:700;color:${w.daysLeft <= 7 ? '#f87171' : '#fb923c'};">
        ${w.daysLeft <= 0 ? 'EXPIRED' : `${w.daysLeft}d`}
      </td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="background:#f97316;width:48px;height:6px;border-radius:3px;margin-bottom:24px;"></div>
    <h1 style="color:#f97316;font-size:22px;font-weight:700;margin:0 0 8px;">Welder Certification Alert</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;">${esc(orgName)} — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
    <p style="color:#e2e8f0;font-size:14px;margin:0 0 20px;">
      The following welders have certifications expiring within <strong style="color:#fb923c;">30 days</strong> or already expired.
      Expired certifications must be renewed before the welder can continue working.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Welder</th>
          <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Stamp</th>
          <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Expiry Date</th>
          <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:28px;">
      <a href="${APP_URL}/welders" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;font-weight:600;font-size:14px;text-decoration:none;border-radius:8px;">
        Manage Welders →
      </a>
    </div>
    <p style="color:#334155;font-size:12px;margin-top:32px;">PipeField OS · Automated certification alert</p>
  </div>
</body>
</html>`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ Welder Cert Alert — ${expiringWelders.length} certification${expiringWelders.length > 1 ? 's' : ''} expiring soon · ${esc(orgName)}`,
    html,
  })
}

// ── New user / welcome ────────────────────────────────────────

export async function sendWelcomeEmail({
  to,
  fullName,
  orgName,
}: {
  to:       string
  fullName: string
  orgName:  string
}) {
  const subject = `Welcome to PipeField OS, ${fullName}!`

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">
    <div style="background:#f97316 15;border-bottom:2px solid #f9731640;padding:24px 32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">🔧</div>
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#f9fafb;">Welcome to PipeField OS</h1>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:14px;">Built for the field, by people who get it.</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#d1d5db;font-size:15px;">Hi ${fullName},</p>
      <p style="color:#9ca3af;font-size:14px;line-height:1.7;">
        You've been added to <strong style="color:#d1d5db;">${esc(orgName)}</strong> on PipeField OS.
        You can now log welds, track spools, run offset calculations, and submit daily reports — all from your phone on the job site.
      </p>
      <a href="${APP_URL}/dashboard"
         style="display:block;text-align:center;background:#f97316;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;margin:24px 0;">
        Open PipeField OS →
      </a>
      <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">pipefield-os.com</p>
    </div>
  </div>
</body>
</html>`

  return getResend().emails.send({ from: FROM, to, subject, html })
}
