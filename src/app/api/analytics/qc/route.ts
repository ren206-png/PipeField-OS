// ============================================================
// GET /api/analytics/qc — QC Analytics for the org or a project
// Query params:
//   project_id — optional UUID, if omitted = org-wide
//   period     — '7d' | '30d' | '90d'  (default '30d')
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export interface QcAnalytics {
  period: string
  project_id: string | null
  // Weld stats
  total_welds: number
  welds_by_status: Record<string, number>
  weld_pass_rate: number
  welds_created_by_day: { date: string; count: number }[]
  // Qual enforcement
  qual_flags_raised: number
  qual_flags_resolved: number
  qual_blocks: number
  // NDE stats
  nde_total_selected: number
  nde_pass_count: number
  nde_fail_count: number
  nde_pass_rate: number
  nde_by_type: Record<string, { total: number; pass: number; fail: number }>
  // Flange stats
  total_flanges: number
  flanges_by_status: Record<string, number>
  // Material trace
  total_heat_numbers: number
  mtrs_on_file: number
  // AI usage
  ai_invocations: number
  ai_top_capabilities: { capability: string; count: number }[]
}

function parsePeriod(raw: string | null): number {
  if (raw === '7d') return 7
  if (raw === '90d') return 90
  return 30
}

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id') ?? null
  const periodDays = parsePeriod(searchParams.get('period'))
  const periodLabel = `${periodDays}d`
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  const orgId = caller.organization_id
  const admin = createAdminClient()

  // ── Welds ──────────────────────────────────────────────────
  let weldsQuery = admin
    .from('welds')
    .select('id, status, created_at, base_metal_heat_a, base_metal_heat_b')
    .eq('organization_id', orgId)

  if (projectId) weldsQuery = weldsQuery.eq('project_id', projectId)

  const { data: allWelds } = await weldsQuery

  const welds = allWelds ?? []
  const total_welds = welds.length

  const welds_by_status: Record<string, number> = {}
  for (const w of welds) {
    const s = (w.status as string) ?? 'unknown'
    welds_by_status[s] = (welds_by_status[s] ?? 0) + 1
  }

  const accepted = welds_by_status['accepted'] ?? 0
  const rejected = welds_by_status['rejected'] ?? 0
  const weld_pass_rate = accepted + rejected > 0
    ? Math.round((accepted / (accepted + rejected)) * 10000) / 100
    : 0

  // Welds created within period, grouped by date
  const weldsInPeriod = welds.filter(w => w.created_at >= periodStart)
  const dayMap: Record<string, number> = {}
  for (const w of weldsInPeriod) {
    const day = (w.created_at as string).slice(0, 10)
    dayMap[day] = (dayMap[day] ?? 0) + 1
  }
  const welds_created_by_day = Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  // Heat numbers (distinct)
  const heatSet = new Set<string>()
  for (const w of welds) {
    if (w.base_metal_heat_a) heatSet.add(w.base_metal_heat_a as string)
    if (w.base_metal_heat_b) heatSet.add(w.base_metal_heat_b as string)
  }
  const total_heat_numbers = heatSet.size

  // ── Weld events (qual enforcement) ────────────────────────
  let eventsQuery = admin
    .from('weld_events')
    .select('event_type')
    .eq('organization_id', orgId)
    .gte('created_at', periodStart)
    .in('event_type', ['qual_flagged', 'qual_blocked', 'qual_overridden'])

  if (projectId) eventsQuery = eventsQuery.eq('project_id', projectId)

  const { data: events } = await eventsQuery
  const eventRows = events ?? []

  let qual_flags_raised = 0
  let qual_flags_resolved = 0
  let qual_blocks = 0
  for (const e of eventRows) {
    const et = e.event_type as string
    if (et === 'qual_flagged' || et === 'qual_blocked') qual_flags_raised++
    if (et === 'qual_overridden') qual_flags_resolved++
    if (et === 'qual_blocked') qual_blocks++
  }

  // ── NDE selections ─────────────────────────────────────────
  let ndeQuery = admin
    .from('nde_selections')
    .select('inspection_type, result, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', periodStart)

  if (projectId) {
    // Filter via nde_plans join — get plan ids for this project first
    const { data: plans } = await admin
      .from('nde_plans')
      .select('id')
      .eq('organization_id', orgId)
      .eq('project_id', projectId)

    const planIds = (plans ?? []).map((p: { id: string }) => p.id)
    if (planIds.length === 0) {
      // No plans for this project — NDE stats will be zero
      ndeQuery = ndeQuery.in('nde_plan_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      ndeQuery = ndeQuery.in('nde_plan_id', planIds)
    }
  }

  const { data: ndeRows } = await ndeQuery
  const nde = ndeRows ?? []

  const nde_total_selected = nde.length
  const nde_pass_count = nde.filter(r => (r.result as string) === 'pass').length
  const nde_fail_count = nde.filter(r => (r.result as string) === 'fail').length
  const nde_pass_rate = nde_total_selected > 0
    ? Math.round((nde_pass_count / nde_total_selected) * 10000) / 100
    : 0

  const nde_by_type: Record<string, { total: number; pass: number; fail: number }> = {}
  for (const r of nde) {
    const t = (r.inspection_type as string) ?? 'unknown'
    if (!nde_by_type[t]) nde_by_type[t] = { total: 0, pass: 0, fail: 0 }
    nde_by_type[t].total++
    if ((r.result as string) === 'pass') nde_by_type[t].pass++
    if ((r.result as string) === 'fail') nde_by_type[t].fail++
  }

  // ── Flanges ───────────────────────────────────────────────
  let flangesQuery = admin
    .from('flanges')
    .select('status')
    .eq('organization_id', orgId)

  if (projectId) flangesQuery = flangesQuery.eq('project_id', projectId)

  const { data: flangeRows } = await flangesQuery
  const flanges = flangeRows ?? []
  const total_flanges = flanges.length
  const flanges_by_status: Record<string, number> = {}
  for (const f of flanges) {
    const s = (f.status as string) ?? 'unknown'
    flanges_by_status[s] = (flanges_by_status[s] ?? 0) + 1
  }

  // ── MTR documents ─────────────────────────────────────────
  const { count: mtrs_on_file } = await admin
    .from('mtr_documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  // ── AI invocations ────────────────────────────────────────
  const { data: aiRows } = await admin
    .from('ai_invocations')
    .select('capability')
    .eq('organization_id', orgId)
    .gte('invoked_at', periodStart)

  const aiInvocationRows = aiRows ?? []
  const ai_invocations = aiInvocationRows.length

  const capMap: Record<string, number> = {}
  for (const r of aiInvocationRows) {
    const cap = (r.capability as string) ?? 'unknown'
    capMap[cap] = (capMap[cap] ?? 0) + 1
  }
  const ai_top_capabilities = Object.entries(capMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([capability, count]) => ({ capability, count }))

  const result: QcAnalytics = {
    period: periodLabel,
    project_id: projectId,
    total_welds,
    welds_by_status,
    weld_pass_rate,
    welds_created_by_day,
    qual_flags_raised,
    qual_flags_resolved,
    qual_blocks,
    nde_total_selected,
    nde_pass_count,
    nde_fail_count,
    nde_pass_rate,
    nde_by_type,
    total_flanges,
    flanges_by_status,
    total_heat_numbers,
    mtrs_on_file: mtrs_on_file ?? 0,
    ai_invocations,
    ai_top_capabilities,
  }

  return NextResponse.json(result)
}
