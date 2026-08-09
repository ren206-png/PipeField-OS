// ============================================================
// POST /api/cron/health-monitor
// Vercel Cron — fires every 5 minutes.
// Runs 4 monitoring jobs:
//   1. Error spike detection per capability
//   2. AI token budget exhaustion warnings
//   3. Self-healing auto-disable of failing capabilities
//   4. Critical alert notifications to platform admins
//
// Auth: Bearer token via CRON_SECRET env var.
// Supabase: uses service role key (bypasses RLS).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend } from '@/lib/email'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const DAILY_TOKEN_BUDGETS: Record<string, number> = {
  starter:      10_000,
  field_pro:    50_000,
  professional: 150_000,
  enterprise:   500_000,
}

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cronStartedAt = new Date()
  const supabase = createAdminClient()

  const jobs = {
    errorSpike:   { alertsCreated: 0, error: null as string | null },
    budgetWarning:{ alertsCreated: 0, error: null as string | null },
    selfHealing:  { disabledCapabilities: 0, error: null as string | null },
    notifications:{ sent: 0, error: null as string | null },
  }

  // ── Job 1: Error spike detection ─────────────────────────────
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const { data: caps } = await supabase
      .from('ai_invocations')
      .select('capability')
      .gte('invoked_at', since7d.toISOString())
      .order('capability')

    const distinctCaps = Array.from(new Set((caps ?? []).map(r => r.capability as string)))

    for (const cap of distinctCaps) {
      const hourStart = new Date()
      hourStart.setMinutes(0, 0, 0)

      const [currentRes, baselineRes] = await Promise.all([
        supabase.rpc('get_ai_error_rate', {
          p_capability:   cap,
          p_window_start: hourStart.toISOString(),
          p_window_end:   new Date().toISOString(),
        }),
        supabase.rpc('get_ai_error_rate', {
          p_capability:   cap,
          p_window_start: since7d.toISOString(),
          p_window_end:   hourStart.toISOString(),
        }),
      ])

      const current  = currentRes.data as Array<{ total: number; errors: number; error_rate: number }> | null
      const baseline = baselineRes.data as Array<{ total: number; errors: number; error_rate: number }> | null

      if (!current?.[0] || Number(current[0].total) < 10) continue

      const currentRate  = Number(current[0].error_rate)
      const baselineRate = Number(baseline?.[0]?.error_rate ?? 0)
      const spikeMultiple = baselineRate > 0
        ? currentRate / baselineRate
        : (currentRate > 0 ? 999 : 0)

      if (spikeMultiple >= 3 && currentRate > 5) {
        await supabase.from('system_alerts').insert({
          alert_type: 'error_spike',
          severity:   spikeMultiple >= 5 ? 'critical' : 'warning',
          capability: cap,
          title:      `Error spike detected: ${cap}`,
          body:       `Current error rate ${currentRate.toFixed(1)}% is ${spikeMultiple.toFixed(1)}x above baseline (${baselineRate.toFixed(1)}%)`,
          metadata:   { currentRate, baselineRate, spikeMultiple, total: current[0].total },
        })
        jobs.errorSpike.alertsCreated++
      }
    }
  } catch (err) {
    jobs.errorSpike.error = err instanceof Error ? err.message : String(err)
    console.error('[health-monitor] Job 1 (error spike) failed:', err)
  }

  // ── Job 2: Budget exhaustion warning ─────────────────────────
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: usage } = await supabase
      .from('ai_invocations')
      .select('organization_id, tokens_used')
      .gte('invoked_at', todayStart.toISOString())

    const orgTokens = new Map<string, number>()
    for (const row of usage ?? []) {
      const oid = row.organization_id as string
      orgTokens.set(oid, (orgTokens.get(oid) ?? 0) + ((row.tokens_used as number) ?? 0))
    }

    if (orgTokens.size > 0) {
      const orgIds = Array.from(orgTokens.keys())
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, subscription_tier')
        .in('id', orgIds)

      for (const org of orgs ?? []) {
        const tier   = (org.subscription_tier as string) ?? 'starter'
        const budget = DAILY_TOKEN_BUDGETS[tier] ?? DAILY_TOKEN_BUDGETS.starter
        const used   = orgTokens.get(org.id as string) ?? 0
        const pct    = (used / budget) * 100

        if (pct >= 80) {
          await supabase.from('system_alerts').insert({
            alert_type: 'budget_warning',
            severity:   pct >= 95 ? 'critical' : 'warning',
            title:      `AI budget ${pct >= 95 ? 'critical' : 'warning'}: ${tier} org`,
            body:       `Organization has used ${pct.toFixed(0)}% of daily token budget (${used.toLocaleString()} / ${budget.toLocaleString()} tokens)`,
            metadata:   { organization_id: org.id, tier, used, budget, pct },
          })
          jobs.budgetWarning.alertsCreated++
        }
      }
    }
  } catch (err) {
    jobs.budgetWarning.error = err instanceof Error ? err.message : String(err)
    console.error('[health-monitor] Job 2 (budget warning) failed:', err)
  }

  // ── Job 3: Self-healing auto-disable ─────────────────────────
  try {
    const window30m = new Date(Date.now() - 30 * 60 * 1000)
    const { data: recent } = await supabase
      .from('ai_invocations')
      .select('capability, status')
      .gte('invoked_at', window30m.toISOString())

    const capStats = new Map<string, { total: number; errors: number }>()
    for (const row of recent ?? []) {
      const cap      = row.capability as string
      const existing = capStats.get(cap) ?? { total: 0, errors: 0 }
      existing.total++
      if (row.status === 'error') existing.errors++
      capStats.set(cap, existing)
    }

    for (const [cap, stats] of Array.from(capStats)) {
      if (stats.total < 20) continue
      const errorRate = (stats.errors / stats.total) * 100
      if (errorRate > 50) {
        const reason = `Auto-disabled: ${errorRate.toFixed(0)}% error rate in last 30 min (${stats.errors}/${stats.total} requests)`
        await supabase.from('capability_overrides').upsert({
          capability:      cap,
          disabled:        true,
          disabled_reason: reason,
          disabled_at:     new Date().toISOString(),
          auto_disabled:   true,
        }, { onConflict: 'capability' })

        await supabase.from('system_alerts').insert({
          alert_type: 'capability_disabled',
          severity:   'critical',
          capability: cap,
          title:      `Capability auto-disabled: ${cap}`,
          body:       reason,
          metadata:   { errorRate, total: stats.total, errors: stats.errors },
        })
        jobs.selfHealing.disabledCapabilities++
      }
    }
  } catch (err) {
    jobs.selfHealing.error = err instanceof Error ? err.message : String(err)
    console.error('[health-monitor] Job 3 (self-healing) failed:', err)
  }

  // ── Job 4: Notify platform admins for critical alerts ─────────
  try {
    const { data: criticalAlerts } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('severity', 'critical')
      .gte('created_at', cronStartedAt.toISOString())

    if (criticalAlerts && criticalAlerts.length > 0) {
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id, organization_id, email')
        .eq('role', 'platform_admin')

      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'
      const FROM    = process.env.EMAIL_FROM ?? 'PipeField OS <onboarding@resend.dev>'
      const resend  = getResend()

      for (const admin of admins ?? []) {
        for (const alert of criticalAlerts) {
          // In-app notification
          await supabase.from('notifications').insert({
            user_id:         admin.id,
            organization_id: admin.organization_id,
            type:            'system_alert',
            title:           `⚠️ ${alert.title}`,
            message:         alert.body,
            data:            { alert_id: alert.id, alert_type: alert.alert_type, severity: alert.severity },
            read:            false,
          })
          jobs.notifications.sent++

          // Email alert for critical alerts
          if (alert.severity === 'critical' && admin.email) {
            const severityBadgeColor = '#ef4444'
            const timestamp = new Date(alert.created_at ?? Date.now()).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
            })
            const alertTitle  = String(alert.title  ?? '')
            const alertBody   = String(alert.body   ?? '')
            const alertType   = String(alert.alert_type ?? '')
            const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1d27;border-radius:16px;overflow:hidden;border:1px solid #2a2d3a;">
    <div style="background:${severityBadgeColor}15;border-bottom:2px solid ${severityBadgeColor}40;padding:24px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:${severityBadgeColor}20;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">⚠️</div>
        <div>
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">PipeField OS · Platform Alert</p>
          <h1 style="margin:4px 0 0;font-size:18px;font-weight:700;color:#f9fafb;">Critical System Alert</h1>
        </div>
      </div>
    </div>
    <div style="padding:32px;">
      <div style="background:#111318;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2a2d3a;">
        <div style="margin-bottom:14px;">
          <span style="display:inline-block;padding:4px 10px;background:${severityBadgeColor}20;color:${severityBadgeColor};border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">
            CRITICAL
          </span>
        </div>
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#f9fafb;">${alertTitle.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
        <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.6;">${alertBody.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
        <div style="padding-top:14px;border-top:1px solid #2a2d3a;">
          <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Alert Type</p>
          <p style="margin:0 0 12px;font-size:13px;color:#d1d5db;font-family:monospace;">${alertType.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Timestamp</p>
          <p style="margin:0;font-size:13px;color:#d1d5db;">${timestamp}</p>
        </div>
      </div>
      <a href="${APP_URL}/admin/system"
         style="display:block;text-align:center;background:${severityBadgeColor};color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:24px;">
        View System Health →
      </a>
      <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
        PipeField OS · <a href="${APP_URL}" style="color:#6b7280;">pipefield-os.com</a>
      </p>
    </div>
  </div>
</body>
</html>`
            await resend.emails.send({
              from:    FROM,
              to:      admin.email as string,
              subject: `⚠️ PipeField OS Alert: ${alertTitle}`,
              html,
            }).catch((err: unknown) => {
              console.error(`[health-monitor] Failed to send alert email to ${admin.email}:`, err)
            })
          }
        }
      }
    }
  } catch (err) {
    jobs.notifications.error = err instanceof Error ? err.message : String(err)
    console.error('[health-monitor] Job 4 (notifications) failed:', err)
  }

  const durationMs = Date.now() - cronStartedAt.getTime()
  logger.info('health-monitor.done', { durationMs, jobs })

  return NextResponse.json({
    ok:   true,
    jobs: {
      errorSpike:    { alertsCreated: jobs.errorSpike.alertsCreated },
      budgetWarning: { alertsCreated: jobs.budgetWarning.alertsCreated },
      selfHealing:   { disabledCapabilities: jobs.selfHealing.disabledCapabilities },
      notifications: { sent: jobs.notifications.sent },
    },
    durationMs,
  })
}
