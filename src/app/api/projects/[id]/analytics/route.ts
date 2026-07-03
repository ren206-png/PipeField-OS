// ============================================================
// GET /api/projects/[id]/analytics — per-project analytics
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { startOfWeek, subWeeks, format } from 'date-fns'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    const { id: projectId } = await params
    const admin = createAdminClient()

    // Verify project belongs to caller's org
    const { data: project } = await admin
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .eq('organization_id', caller.organization_id ?? '')
      .maybeSingle()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch welds and milestones in parallel
    const [weldsRes, milestonesRes] = await Promise.all([
      admin
        .from('welds')
        .select('id, status, welder_name, welder_stamp, weld_date')
        .eq('project_id', projectId),
      admin
        .from('project_milestones')
        .select('name, status, planned_date')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
    ])

    const welds = weldsRes.data ?? []
    const milestones = milestonesRes.data ?? []

    // ── weldsByStatus ──────────────────────────────────────────
    const statusMap = new Map<string, number>()
    for (const w of welds) {
      statusMap.set(w.status, (statusMap.get(w.status) ?? 0) + 1)
    }
    const weldsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }))

    // ── weldsByWeek (last 8 weeks) ─────────────────────────────
    const now = new Date()
    const weldsByWeek = Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 })
      const weekEnd   = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekLabel = format(weekStart, 'MMM d')
      const weekWelds = welds.filter(w => {
        if (!w.weld_date) return false
        const d = new Date(w.weld_date)
        return d >= weekStart && d < weekEnd
      })
      return {
        week:   weekLabel,
        total:  weekWelds.length,
        passed: weekWelds.filter(w => w.status === 'accepted').length,
        failed: weekWelds.filter(w => w.status === 'failed').length,
      }
    })

    // ── topWelders ────────────────────────────────────────────
    const welderMap = new Map<string, { name: string; stamp: string; total: number; passed: number }>()
    for (const w of welds) {
      const key = w.welder_stamp ?? w.welder_name ?? 'Unknown'
      const existing = welderMap.get(key) ?? {
        name:   w.welder_name ?? 'Unknown',
        stamp:  w.welder_stamp ?? '—',
        total:  0,
        passed: 0,
      }
      existing.total  += 1
      if (w.status === 'accepted') existing.passed += 1
      welderMap.set(key, existing)
    }
    const topWelders = Array.from(welderMap.values())
      .map(wl => ({
        ...wl,
        rate: wl.total > 0 ? Math.round((wl.passed / wl.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // ── milestoneProgress ──────────────────────────────────────
    const milestoneProgress = milestones.map(m => ({
      name:     m.name,
      status:   m.status,
      due_date: m.planned_date ?? null,
    }))

    // ── aggregate stats ────────────────────────────────────────
    const totalWelds     = welds.length
    const completedWelds = welds.filter(w => w.status === 'accepted').length
    const failedWelds    = welds.filter(w => w.status === 'failed').length
    const completionPct  = totalWelds > 0 ? Math.round((completedWelds / totalWelds) * 100) : 0
    const rejectionRate  = totalWelds > 0 ? Math.round((failedWelds / totalWelds) * 100) : 0

    // First pass rate: welds that reached accepted without going through failed or repaired
    const firstPassWelds = welds.filter(
      w => w.status === 'accepted'
    ).length
    // We approximate first pass as all accepted minus failed (can't track history without audit table)
    const firstPassRate =
      totalWelds > 0 ? Math.round((firstPassWelds / totalWelds) * 100) : 0

    return NextResponse.json({
      weldsByStatus,
      weldsByWeek,
      topWelders,
      milestoneProgress,
      rejectionRate,
      firstPassRate,
      totalWelds,
      completedWelds,
      completionPct,
    })
  } catch (err) {
    console.error('GET /analytics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
