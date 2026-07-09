// ============================================================
// GET /api/admin/system-health
// Platform admin only. Returns system health data:
//   - Last 50 system alerts
//   - Disabled capability overrides
//   - Error rates per capability (last hour vs 7d baseline)
//   - Circuit breaker states
//   - Quick health summary
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { getAllBreakerStates } from '@/lib/circuit-breaker'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  void req
  try {
    const authResult = await requirePlatformAdmin()
    if (authResult.error) return authResult.error

    const supabase = createAdminClient()
    const now       = new Date()
    const hourStart = new Date(now)
    hourStart.setMinutes(0, 0, 0)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      alertsRes,
      overridesRes,
      capsRes,
      invocationsHourRes,
      dbHealthRes,
    ] = await Promise.allSettled([
      // Last 50 alerts
      supabase
        .from('system_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),

      // Disabled capability overrides
      supabase
        .from('capability_overrides')
        .select('*')
        .eq('disabled', true),

      // Top 10 capabilities in last 7 days (by invocation count)
      supabase
        .from('ai_invocations')
        .select('capability')
        .gte('invoked_at', since7d.toISOString()),

      // Invocations in last hour (for quick summary count)
      supabase
        .from('ai_invocations')
        .select('id', { count: 'exact', head: true })
        .gte('invoked_at', hourStart.toISOString()),

      // Quick DB health check
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
    ])

    // Resolve alerts
    const alerts = alertsRes.status === 'fulfilled' ? (alertsRes.value.data ?? []) : []

    // Resolve overrides
    const capabilityOverrides = overridesRes.status === 'fulfilled' ? (overridesRes.value.data ?? []) : []

    // Build top 10 capabilities
    const allCapRows = capsRes.status === 'fulfilled' ? (capsRes.value.data ?? []) : []
    const capCounts = new Map<string, number>()
    for (const row of allCapRows) {
      const cap = row.capability as string
      capCounts.set(cap, (capCounts.get(cap) ?? 0) + 1)
    }
    const top10Caps = Array.from(capCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cap]) => cap)

    // Fetch error rates for top 10
    const errorRates = await Promise.allSettled(
      top10Caps.map(async (cap) => {
        const [currentRes, baselineRes] = await Promise.all([
          supabase.rpc('get_ai_error_rate', {
            p_capability:   cap,
            p_window_start: hourStart.toISOString(),
            p_window_end:   now.toISOString(),
          }),
          supabase.rpc('get_ai_error_rate', {
            p_capability:   cap,
            p_window_start: since7d.toISOString(),
            p_window_end:   hourStart.toISOString(),
          }),
        ])

        type RateRow = { total: number; errors: number; error_rate: number }
        const current  = currentRes.data  as RateRow[] | null
        const baseline = baselineRes.data as RateRow[] | null

        const currentRate  = Number(current?.[0]?.error_rate  ?? 0)
        const baselineRate = Number(baseline?.[0]?.error_rate ?? 0)
        const currentTotal = Number(current?.[0]?.total ?? 0)
        const spikeMultiple = baselineRate > 0
          ? currentRate / baselineRate
          : (currentRate > 0 ? 999 : 0)

        return {
          capability:    cap,
          invocations1h: currentTotal,
          errorRate1h:   currentRate,
          baselineRate,
          spikeMultiple,
          isSpike:       spikeMultiple >= 3 && currentRate > 5,
        }
      })
    )

    const errorRateData = errorRates
      .filter((r): r is PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer V> ? V : never> => r.status === 'fulfilled')
      .map(r => r.value)

    // Quick summary
    const invocationsLastHour = invocationsHourRes.status === 'fulfilled'
      ? (invocationsHourRes.value.count ?? 0)
      : 0
    const dbOk = dbHealthRes.status === 'fulfilled' && !dbHealthRes.value.error

    const circuitBreakers = getAllBreakerStates()

    return NextResponse.json({
      alerts,
      capabilityOverrides,
      errorRates: errorRateData,
      circuitBreakers,
      summary: {
        dbOk,
        invocationsLastHour,
        disabledCapabilities: capabilityOverrides.length,
        criticalAlerts: alerts.filter((a: { severity: string }) => a.severity === 'critical').length,
      },
    })
  } catch (err) {
    console.error('[/api/admin/system-health GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
