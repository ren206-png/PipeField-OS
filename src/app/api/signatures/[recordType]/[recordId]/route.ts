// ============================================================
// GET /api/signatures/[recordType]/[recordId]
// Returns all signatures for the given record, org-scoped.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordType: string; recordId: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const { recordType, recordId } = await params

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('signatures')
      .select('*')
      .eq('organization_id', caller.organization_id)
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .order('signed_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ signatures: data ?? [] })
  } catch (err) {
    console.error('GET /api/signatures/[recordType]/[recordId] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
