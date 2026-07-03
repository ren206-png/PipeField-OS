// ============================================================
// POST /api/signatures — create a signature for a record
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const createSchema = z.object({
  recordType:    z.string().min(1),
  recordId:      z.string().uuid(),
  role:          z.string().min(1),
  signerName:    z.string().min(1).max(200),
  signerTitle:   z.string().max(200).optional().nullable(),
  signatureData: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
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

    const admin = createAdminClient()
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
