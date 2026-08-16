// GET /api/welders/[id]/continuity — welder continuity records with derived status
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function computeContinuityStatus(expiresDate: string | null): {
  continuity_status: string
  days_remaining: number | null
} {
  if (!expiresDate) {
    return { continuity_status: 'UNKNOWN', days_remaining: null }
  }
  const now = new Date()
  const expires = new Date(expiresDate)
  const diffMs = expires.getTime() - now.getTime()
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let continuity_status: string
  if (daysRemaining < 0) {
    continuity_status = 'EXPIRED'
  } else if (daysRemaining <= 30) {
    continuity_status = 'CLOSE_TO_EXPIRY'
  } else {
    continuity_status = 'ACTIVE'
  }

  return { continuity_status, days_remaining: daysRemaining }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const admin = createAdminClient()
    const welderId = params.id

    const { data, error } = await admin
      .from('welder_continuity')
      .select('*')
      .eq('welder_id', welderId)
      .eq('organization_id', caller.organization_id)
      .order('process', { ascending: true })
      .order('position', { ascending: true })

    if (error) throw error

    if (!data || data.length === 0) {
      // Return empty result rather than 404 — the welder may simply have no records yet
      return NextResponse.json({
        welder_id: welderId,
        continuity_records: [],
        has_expiring_soon: false,
        has_expired: false,
      })
    }

    const continuityRecords = data.map((row) => {
      const { continuity_status, days_remaining } = computeContinuityStatus(row.expires_date)
      return {
        process: row.process,
        position: row.position,
        standard: row.standard ?? null,
        last_weld_date: row.last_weld_date ?? null,
        expires_date: row.expires_date ?? null,
        continuity_status,
        days_remaining,
      }
    })

    const hasExpiringSoon = continuityRecords.some(
      (r) => r.continuity_status === 'CLOSE_TO_EXPIRY'
    )
    const hasExpired = continuityRecords.some(
      (r) => r.continuity_status === 'EXPIRED'
    )

    return NextResponse.json({
      welder_id: welderId,
      continuity_records: continuityRecords,
      has_expiring_soon: hasExpiringSoon,
      has_expired: hasExpired,
    })
  } catch (err) {
    console.error('[GET /api/welders/[id]/continuity]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
