// GET /api/erp/sync-status
// Returns a summary of ERP connectors and weld-export counts for the caller's org.
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [connectorsRes, exportsRes] = await Promise.all([
    admin
      .from('erp_connectors')
      .select('id, erp_type, display_name, test_status, last_sync')
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: false }),

    admin
      .from('erp_weld_exports')
      .select('export_status')
      .eq('organization_id', caller.organization_id),
  ])

  if (connectorsRes.error) {
    return NextResponse.json({ error: connectorsRes.error.message }, { status: 400 })
  }
  if (exportsRes.error) {
    return NextResponse.json({ error: exportsRes.error.message }, { status: 400 })
  }

  const exports       = exportsRes.data ?? []
  const total_exports   = exports.length
  const pending_exports = exports.filter((e) => e.export_status === 'pending').length
  const failed_exports  = exports.filter((e) => e.export_status === 'failed').length

  return NextResponse.json({
    connectors:      connectorsRes.data ?? [],
    pending_exports,
    failed_exports,
    total_exports,
  })
}
