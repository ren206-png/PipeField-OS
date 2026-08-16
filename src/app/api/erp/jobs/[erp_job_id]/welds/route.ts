// POST /api/erp/jobs/[erp_job_id]/welds
// Exports a single weld to the ERP job and records the result.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  connector_id: z.string().uuid(),
  weld_id:      z.string().uuid(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { erp_job_id: string } },
) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const { connector_id, weld_id } = parsed.data
  const admin = createAdminClient()

  // Fetch weld — verify org ownership
  const { data: weld, error: weldErr } = await admin
    .from('welds')
    .select('id, weld_id_number, welder_name, welder_stamp, weld_process, weld_date, status, notes, organization_id, project_id')
    .eq('id', weld_id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (weldErr) return NextResponse.json({ error: weldErr.message }, { status: 400 })
  if (!weld)   return NextResponse.json({ error: 'Weld not found' }, { status: 404 })

  // Fetch connector — verify org ownership
  const { data: connector, error: connErr } = await admin
    .from('erp_connectors')
    .select('id, erp_api_url, erp_api_key_encrypted, auth_method')
    .eq('id', connector_id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (connErr)   return NextResponse.json({ error: connErr.message }, { status: 400 })
  if (!connector) return NextResponse.json({ error: 'Connector not found' }, { status: 404 })

  const decodedKey = Buffer.from(connector.erp_api_key_encrypted as string, 'base64').toString('utf8')
  const authHeader = `Bearer ${decodedKey}`

  const exportPayload = {
    weld_id_number: weld.weld_id_number,
    welder_name:    weld.welder_name,
    welder_stamp:   weld.welder_stamp,
    process:        weld.weld_process,
    weld_date:      weld.weld_date,
    status:         weld.status,
    notes:          weld.notes,
    exported_at:    new Date().toISOString(),
    source:         'PipeField OS',
  }

  let export_status: string
  let erp_response: unknown = null

  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 10_000)

    const erpRes = await fetch(
      `${connector.erp_api_url}/api/jobs/${params.erp_job_id}/welds`,
      {
        method:  'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body:   JSON.stringify(exportPayload),
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeout))

    erp_response  = erpRes.ok ? await erpRes.json().catch(() => null) : { status: erpRes.status }
    export_status = erpRes.ok ? 'success' : 'failed'
  } catch {
    export_status = 'failed'
    erp_response  = { error: 'Network error or timeout' }
  }

  const now = new Date().toISOString()

  // Record export attempt
  await admin.from('erp_weld_exports').insert({
    connector_id,
    weld_id,
    erp_job_id:    params.erp_job_id,
    export_status,
    erp_response,
    exported_at:   now,
    exported_by:   caller.id,
    organization_id: caller.organization_id,
  })

  // Update last_sync on connector
  await admin
    .from('erp_connectors')
    .update({ last_sync: now })
    .eq('id', connector_id)

  return NextResponse.json({ export_status, erp_response }, { status: export_status === 'success' ? 200 : 502 })
}
