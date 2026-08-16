// GET  /api/erp/jobs?connector_id=UUID&status=IN_PROGRESS
// POST /api/erp/jobs — create / trigger a job sync (Professional+ only)
// Fetches jobs from the ERP and caches results in erp_job_mappings.
// Falls back to cached rows when the ERP is unreachable.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TIER_ORDER: Record<string, number> = {
  free_trial: 0, field_pro: 1, starter: 2, professional: 3, enterprise: 4,
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const connector_id     = searchParams.get('connector_id')
  const status           = searchParams.get('status') ?? 'IN_PROGRESS'

  if (!connector_id) {
    return NextResponse.json({ error: 'connector_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify connector belongs to caller's org
  const { data: connector, error: connErr } = await admin
    .from('erp_connectors')
    .select('id, erp_api_url, erp_api_key_encrypted, auth_method')
    .eq('id', connector_id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 400 })
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const decodedKey = Buffer.from(connector.erp_api_key_encrypted as string, 'base64').toString('utf8')
  const authHeader = `Bearer ${decodedKey}`
  const synced_at  = new Date().toISOString()

  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 10_000)

    const erpRes = await fetch(
      `${connector.erp_api_url}/api/jobs?status=${encodeURIComponent(status)}`,
      {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        signal:  controller.signal,
      },
    ).finally(() => clearTimeout(timeout))

    if (!erpRes.ok) throw new Error(`ERP returned ${erpRes.status}`)

    const jobs = await erpRes.json() as Record<string, unknown>[]

    // Upsert into cache
    if (Array.isArray(jobs) && jobs.length > 0) {
      const rows = jobs.map((j) => ({
        connector_id,
        erp_job_id:     String((j as { id?: unknown }).id ?? (j as { job_id?: unknown }).job_id ?? ''),
        customer_name:  String((j as { customer_name?: unknown; customer?: unknown }).customer_name ?? (j as { customer?: unknown }).customer ?? ''),
        raw_erp_data:   j,
        synced_at,
      }))

      await admin
        .from('erp_job_mappings')
        .upsert(rows, { onConflict: 'connector_id,erp_job_id' })
    }

    return NextResponse.json({ source: 'live', jobs, synced_at })
  } catch {
    // ERP unreachable — return cached rows
    const { data: cached } = await admin
      .from('erp_job_mappings')
      .select('erp_job_id, customer_name, raw_erp_data, synced_at')
      .eq('connector_id', connector_id)
      .order('synced_at', { ascending: false })

    const lastSync = cached?.[0]?.synced_at ?? null

    return NextResponse.json({
      source:    'cache',
      jobs:      (cached ?? []).map((r) => r.raw_erp_data),
      synced_at: lastSync,
    })
  }
}

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  // ── Plan gate: Professional or higher required ────────────
  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('subscription_tier')
    .eq('id', caller.organization_id)
    .single()
  const tier = (org?.subscription_tier ?? 'free_trial') as string
  if ((TIER_ORDER[tier] ?? 0) < TIER_ORDER['professional']) {
    return NextResponse.json(
      { error: 'ERP integration requires Professional plan or higher', requiredTier: 'professional' },
      { status: 403 },
    )
  }

  return NextResponse.json({ message: 'Job sync initiated' }, { status: 202 })
}
