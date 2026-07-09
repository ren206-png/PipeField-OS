// ============================================================
// GET /api/analytics/welder-risk
// Returns risk scores for all welders in the org based on
// their recent rejection rate trends.
//
// Risk levels:
//   critical  — rejection rate > 15% in last 30 days
//   warning   — rejection rate > 8% in last 30 days
//   watch     — rejection rate trending upward over 7 days
//   good      — pass rate ≥ 92%
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const admin  = createAdminClient()
  const orgId  = caller.organization_id
  const now    = new Date()
  const day30  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const day7   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch all welds with a date in the last 30 days
  const { data: welds } = await admin
    .from('welds')
    .select('welder_stamp, welder_name, status, weld_date')
    .eq('organization_id', orgId)
    .gte('weld_date', day30)
    .in('status', ['accepted', 'failed', 'rejected'])

  if (!welds || welds.length === 0) {
    return NextResponse.json({ welders: [], generated_at: now.toISOString() })
  }

  // Group by welder stamp
  const byWelder = new Map<string, { name: string; all: typeof welds; recent: typeof welds }>()
  for (const w of welds) {
    const key = w.welder_stamp ?? w.welder_name ?? 'Unknown'
    if (!byWelder.has(key)) {
      byWelder.set(key, { name: w.welder_name ?? key, all: [], recent: [] })
    }
    const entry = byWelder.get(key)!
    entry.all.push(w)
    if (w.weld_date && w.weld_date >= day7) entry.recent.push(w)
  }

  const welders = Array.from(byWelder.entries()).map(([stamp, data]) => {
    const total30   = data.all.length
    const failed30  = data.all.filter(w => w.status === 'failed' || w.status === 'rejected').length
    const rate30    = total30 > 0 ? failed30 / total30 : 0

    const total7    = data.recent.length
    const failed7   = data.recent.filter(w => w.status === 'failed' || w.status === 'rejected').length
    const rate7     = total7 > 0 ? failed7 / total7 : 0

    const trending_up = total7 >= 3 && rate7 > rate30 + 0.05

    const risk: 'critical' | 'warning' | 'watch' | 'good' =
      rate30 > 0.15 ? 'critical' :
      rate30 > 0.08 ? 'warning' :
      trending_up   ? 'watch' : 'good'

    return {
      stamp,
      name:        data.name,
      total_30d:   total30,
      failed_30d:  failed30,
      rate_30d:    Math.round(rate30 * 100),
      total_7d:    total7,
      failed_7d:   failed7,
      rate_7d:     Math.round(rate7 * 100),
      trending_up,
      risk,
    }
  })

  // Sort: critical first, then warning, then watch, then good; within each group by rate desc
  const order = { critical: 0, warning: 1, watch: 2, good: 3 }
  welders.sort((a, b) => order[a.risk] - order[b.risk] || b.rate_30d - a.rate_30d)

  return NextResponse.json({ welders, generated_at: now.toISOString() })
}
