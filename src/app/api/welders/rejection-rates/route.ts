// ============================================================
// GET /api/welders/rejection-rates
// Returns rejection rate stats per welder for the last 90 days,
// joined with welder names. Scoped to the caller's org.
// Sorted by rate descending.
// ============================================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 90

export interface WelderRejectionRate {
  welderId:   string
  welderName: string
  stamp:      string
  total:      number
  failed:     number
  rate:       number
}

export async function GET() {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS)
    const cutoffIso = cutoff.toISOString()

    const admin = createAdminClient()

    // Fetch all welds in the last 90 days for this org that have a welder_id
    const { data: welds, error: weldsError } = await admin
      .from('welds')
      .select('welder_id, status')
      .eq('organization_id', caller.organization_id)
      .gte('created_at', cutoffIso)
      .not('welder_id', 'is', null)

    if (weldsError) throw weldsError

    if (!welds || welds.length === 0) {
      return NextResponse.json([])
    }

    // Aggregate totals and failed counts per welder_id in memory
    const stats = new Map<string, { total: number; failed: number }>()
    for (const weld of welds) {
      const wId = weld.welder_id as string
      const existing = stats.get(wId) ?? { total: 0, failed: 0 }
      existing.total++
      if (weld.status === 'failed') existing.failed++
      stats.set(wId, existing)
    }

    // Fetch welder details for all relevant welder IDs
    const welderIds = Array.from(stats.keys())
    const { data: welders, error: weldersError } = await admin
      .from('welders')
      .select('id, full_name, stamp')
      .eq('organization_id', caller.organization_id)
      .in('id', welderIds)

    if (weldersError) throw weldersError

    const welderMap = new Map(
      (welders ?? []).map(w => [w.id, { full_name: w.full_name as string, stamp: w.stamp as string }])
    )

    // Build result array
    const result: WelderRejectionRate[] = []
    for (const [welderId, { total, failed }] of Array.from(stats.entries())) {
      const info = welderMap.get(welderId)
      if (!info) continue // Welder deleted or not found — skip
      result.push({
        welderId,
        welderName: info.full_name,
        stamp:      info.stamp,
        total,
        failed,
        rate:       total > 0 ? failed / total : 0,
      })
    }

    // Sort by rate descending
    result.sort((a, b) => b.rate - a.rate)

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/welders/rejection-rates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
