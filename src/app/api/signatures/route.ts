// ============================================================
// POST /api/signatures — create a signature for a record
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Signable records and their sign-off slots (SEC-004). Signatures are taken
// in person on the device, so signerName is typed — but the record must
// belong to the caller's org, the slot must be real and unsigned, and
// signed_by always records the logged-in user who captured it.
const SIGNABLE: Record<string, { table: string; slots: readonly string[] }> = {
  itp:           { table: 'itps',           slots: ['QC Manager', 'Inspector'] },
  pressure_test: { table: 'pressure_tests', slots: ['Test Technician', 'QC Manager'] },
}

const createSchema = z.object({
  recordType:    z.enum(['itp', 'pressure_test']),
  recordId:      z.string().uuid(),
  role:          z.string().min(1).max(100),
  signerName:    z.string().min(1).max(200),
  signerTitle:   z.string().max(200).optional().nullable(),
  signatureData: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requirePermission(req, 'welds:approve')
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { recordType, recordId, role, signerName, signerTitle, signatureData } = parsed.data

    const signable = SIGNABLE[recordType]
    if (!signable.slots.includes(role)) {
      return NextResponse.json({ error: 'Unknown signature slot' }, { status: 400 })
    }
    if (!signatureData.startsWith('data:image/') || signatureData.length > 500_000) {
      return NextResponse.json({ error: 'Invalid signature image' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: record } = await admin
      .from(signable.table)
      .select('id')
      .eq('id', recordId)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const { data: already } = await admin
      .from('signatures')
      .select('id')
      .eq('organization_id', caller.organization_id)
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .eq('role', role)
      .maybeSingle()
    if (already) {
      return NextResponse.json({ error: 'This slot is already signed' }, { status: 409 })
    }

    const { data, error } = await admin
      .from('signatures')
      .insert({
        organization_id: caller.organization_id,
        record_type:     recordType,
        record_id:       recordId,
        role,
        signer_name:     signerName,
        signer_title:    signerTitle ?? null,
        signature_data:  signatureData,
        signed_by:       caller.auth_user_id,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ signature: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/signatures error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
