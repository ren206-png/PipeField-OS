// GET /api/welds/[id]/events
// Returns the immutable event history for a weld, newest-first.
// Auth: any org member.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getWeldEvents } from '@/lib/weld-events'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { id } = await params

  try {
    const events = await getWeldEvents(id, caller.organization_id)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[/api/welds/[id]/events]', err)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }
}
