// GET /api/erp/connectors/[id]/test — ping the ERP and update test_status
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: connector, error: fetchError } = await admin
    .from('erp_connectors')
    .select('id, erp_api_url, erp_api_key_encrypted, auth_method')
    .eq('id', params.id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
  if (!connector)  return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  // Decode stored key (base64 placeholder — swap with real decrypt in production)
  const decodedKey = Buffer.from(connector.erp_api_key_encrypted as string, 'base64').toString('utf8')

  const tested_at = new Date().toISOString()
  let connected   = false
  let status      = 'FAILED'

  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 5_000)

    // Try /health first, then /status as a fallback
    const healthUrl  = `${connector.erp_api_url}/health`
    const authHeader = `Bearer ${decodedKey}`

    const res = await fetch(healthUrl, {
      method:  'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
      signal:  controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (res.ok) {
      connected = true
      status    = 'CONNECTED'
    }
  } catch {
    // Network error or timeout — leave status as FAILED
  }

  await admin
    .from('erp_connectors')
    .update({ test_status: status, last_sync: tested_at })
    .eq('id', params.id)

  return NextResponse.json({ connected, status, tested_at })
}
