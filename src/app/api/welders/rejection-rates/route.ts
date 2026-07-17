// ============================================================
// GET /api/welders/rejection-rates
// Returns rejection rate stats per welder for the last 90 days.
// Groups by welder_stamp (always populated) rather than welder_id
// (which is often null on weld records).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS)
    const cutoffIso = cutoff.toISOString()

    const admin = createAdminClient()

    // Fetch welds in window that have a welder_stamp assigned
    const { data: welds, error: weldsError } = await admin
      .from('welds')
      .select('welder_stamp, welder_name, status')
      .eq('organization_id', caller.organization_id)
      .gte('created_at', cutoffIso)
      .not('welder_stamp', 'is', null)

    if (weldsError) throw weldsError
    if (!welds || welds.length === 0) return NextResponse.json([])

    // Aggregate by stamp in memory
    const stats = new Map<string, { name: string; total: number; failed: number }>()
    for (const weld of welds) {
      const stamp = String(weld.welder_stamp ?? '').trim().toUpperCase()
      if (!stamp) continue
      const name = String(weld.welder_name ?? stamp)
      const s    = stats.get(stamp) ?? { name, total: 0, failed: 0 }
      s.total++
      if (weld.status === 'failed' || weld.status === 'rejected') s.failed++
      stats.set(stamp, s)
    }

    if (stats.size === 0) return NextResponse.json([])

    // Enrich with welder IDs/names from welders table (best-effort)
    const stamps = Array.from(stats.keys())
    const { data: welders } = await admin
      .from('welders')
      .select('id, full_name, stamp')
      .eq('organization_id', caller.organization_id)
      .in('stamp', stamps)

    const welderMap = new Map(
      (welders ?? []).map(w => [
        String(w.stamp ?? '').trim().toUpperCase(),
        { id: w.id as string, full_name: w.full_name as string },
      ])
    )

    const result: WelderRejectionRate[] = Array.from(stats.entries()).map(([stamp, s]) => {
      const info = welderMap.get(stamp)
      return {
        welderId:   info?.id       ?? stamp,
        welderName: info?.full_name ?? s.name,
        stamp,
        total:  s.total,
        failed: s.failed,
        rate:   s.total > 0 ? s.failed / s.total : 0,
      }
    })

    result.sort((a, b) => b.rate - a.rate)
    return NextResponse.json(result)

  } catch (err) {
    console.error('GET /api/welders/rejection-rates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
