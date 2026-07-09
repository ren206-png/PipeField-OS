// ============================================================
// GET /api/projects/[id]/health
// Returns a composite 0–100 health score for a project.
//
// Score breakdown (each component 0–25 pts):
//   - Weld pass rate:     (accepted / total_welded) * 25
//   - NDE backlog:        25 if 0 pending, scaled down by backlog count
//   - Open issues:        25 if 0 open NCRs+RFIs, scaled by count
//   - Spool progress:     (released / total_spools) * 25
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { id: projectId } = await params
  const admin = createAdminClient()
  const orgId = caller.organization_id

  // Run all queries in parallel
  const [weldsRes, spoolsRes, ncrsRes, rfisRes] = await Promise.all([
    admin
      .from('welds')
      .select('status')
      .eq('project_id', projectId)
      .eq('organization_id', orgId),
    admin
      .from('spools')
      .select('status')
      .eq('project_id', projectId)
      .eq('organization_id', orgId),
    admin
      .from('ncrs')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('organization_id', orgId)
      .in('status', ['open', 'in_review']),
    admin
      .from('rfis')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('organization_id', orgId)
      .in('status', ['open', 'pending']),
  ])

  const welds  = weldsRes.data  ?? []
  const spools = spoolsRes.data ?? []
  const openNcrs = ncrsRes.count ?? 0
  const openRfis = rfisRes.count ?? 0

  // ── Weld pass rate (0–25) ──────────────────────────────────
  const totalWelded = welds.filter(w => w.status !== 'not_welded').length
  const accepted    = welds.filter(w => w.status === 'accepted').length
  const weldScore   = totalWelded > 0 ? (accepted / totalWelded) * 25 : 25

  // ── NDE backlog (0–25) ─────────────────────────────────────
  const ndeBacklog = welds.filter(w => w.status === 'nde_pending').length
  const ndeScore   = ndeBacklog === 0 ? 25 : Math.max(0, 25 - ndeBacklog * 2)

  // ── Open issues (0–25) ────────────────────────────────────
  const totalIssues  = openNcrs + openRfis
  const issueScore   = totalIssues === 0 ? 25 : Math.max(0, 25 - totalIssues * 3)

  // ── Spool progress (0–25) ─────────────────────────────────
  const totalSpools    = spools.length
  const releasedSpools = spools.filter(s => s.status === 'released').length
  const spoolScore     = totalSpools > 0 ? (releasedSpools / totalSpools) * 25 : 25

  const score = Math.round(weldScore + ndeScore + issueScore + spoolScore)

  const grade =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F'

  const status =
    score >= 75 ? 'healthy' :
    score >= 50 ? 'at_risk' : 'critical'

  return NextResponse.json({
    score,
    grade,
    status,
    breakdown: {
      weld_pass_rate: Math.round(weldScore),
      nde_backlog:    Math.round(ndeScore),
      open_issues:    Math.round(issueScore),
      spool_progress: Math.round(spoolScore),
    },
    meta: {
      total_welds:     welds.length,
      accepted_welds:  accepted,
      nde_pending:     ndeBacklog,
      open_ncrs:       openNcrs,
      open_rfis:       openRfis,
      total_spools:    totalSpools,
      released_spools: releasedSpools,
    },
  })
}
