import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Use the standard requireAuth helper — server-verified JWT, consistent
  // with every other API route. The old hand-rolled auth had a null-profile
  // bug where profile?.organization_id silently became undefined, which
  // Supabase ignored (returning all certs across all orgs).
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  // Fail-closed: org_id must be non-null before any query
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization assigned' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') ?? '30')))

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('welder_certifications')
    .select('*, welders(full_name, stamp)')
    .eq('organization_id', caller.organization_id)
    .eq('is_active', true)
    .lte('expiry_date', futureDate.toISOString().split('T')[0])
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .order('expiry_date', { ascending: true })

  if (error) {
    // Log the real error instead of silently swallowing it
    logger.error('welders.certifications.expiring', error)
    return NextResponse.json({ error: 'Failed to fetch certifications' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
