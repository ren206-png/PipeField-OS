// PATCH /api/welds/[id]/override-qualification
// Clears qualification_flag. Requires admin or project_manager role.
// Mandatory reason. Appends to weld_events (permanent).

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeWeldEvent } from '@/lib/weld-events'
import { QUAL_ENFORCEMENT_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!QUAL_ENFORCEMENT_ENABLED) {
    return NextResponse.json({ error: 'Qualification enforcement is not enabled' }, { status: 403 })
  }
  if (!caller?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  // Role check: only admin or project_manager
  if (!['admin', 'project_manager', 'platform_admin'].includes(caller.role ?? '')) {
    return NextResponse.json({ error: 'Only admins and project managers can override qualifications.' }, { status: 403 })
  }

  const { id: weldId } = await params
  const body = await req.json().catch(() => ({})) as { reason?: string }

  if (!body.reason || body.reason.trim().length < 10) {
    return NextResponse.json({ error: 'A reason of at least 10 characters is required to override qualification.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify weld belongs to this org
  const { data: weld } = await admin
    .from('welds')
    .select('id, qualification_flag')
    .eq('id', weldId)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (!weld) return NextResponse.json({ error: 'Weld not found.' }, { status: 404 })
  if (!weld.qualification_flag) return NextResponse.json({ error: 'No qualification flag to override.' }, { status: 400 })

  // Clear the flag (but write to permanent ledger first)
  await writeWeldEvent({
    organizationId: caller.organization_id,
    weldId,
    eventType:      'qual_overridden',
    actorId:        caller.id,
    actorRole:      caller.role ?? 'unknown',
    reason:         body.reason.trim(),
    metadata:       { previousFlag: weld.qualification_flag },
  })

  await admin.from('welds').update({ qualification_flag: null }).eq('id', weldId)

  return NextResponse.json({ success: true, weldId })
}
