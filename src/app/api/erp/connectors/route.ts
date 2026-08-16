// GET /api/erp/connectors  — list all ERP connectors for caller's org
// POST /api/erp/connectors — create a new ERP connector
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  erp_type:       z.enum(['MIE_TRAK', 'SYSPRO', 'DIGIT', 'JOBBOSS', 'GENERIC']),
  display_name:   z.string().min(1).optional(),
  erp_host:       z.string().min(1),
  erp_api_url:    z.string().url(),
  erp_api_key:    z.string().min(1),   // plain text; base64-encoded before storing
  auth_method:    z.enum(['API_KEY', 'OAUTH2', 'BASIC']).default('API_KEY'),
  sync_frequency: z.enum(['HOURLY', 'ON_DEMAND']).default('ON_DEMAND'),
  auto_post_welds:z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('erp_connectors')
    .select('id, erp_type, display_name, erp_host, erp_api_url, auth_method, test_status, last_sync, sync_frequency, auto_post_welds, created_at')
    .eq('organization_id', caller.organization_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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

  const { erp_api_key, ...rest } = parsed.data

  // NOTE: base64 encoding is a placeholder. Replace with proper AES-256 encryption
  // (e.g. Node crypto or a KMS) before handling real customer keys in production.
  const erp_api_key_encrypted = Buffer.from(erp_api_key).toString('base64')

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('erp_connectors')
    .insert({
      ...rest,
      erp_api_key_encrypted,
      organization_id: caller.organization_id,
      created_by:      caller.id,
      test_status:     'UNTESTED',
    })
    .select('id, erp_type, display_name, erp_host, erp_api_url, auth_method, test_status, last_sync, sync_frequency, auto_post_welds, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}
