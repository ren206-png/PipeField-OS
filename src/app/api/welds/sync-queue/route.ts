// POST /api/welds/sync-queue — sync offline weld queue items
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'

export const dynamic = 'force-dynamic'

interface QueueItem {
  local_id: string
  project_id: string
  payload: Record<string, unknown>
}

interface SyncResult {
  local_id: string
  status: 'created' | 'duplicate' | 'error'
  weld_id?: string
  error?: string
}

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!OFFLINE_FIELD_ENABLED) {
    return NextResponse.json({ error: 'Offline field entry is not enabled' }, { status: 403 })
  }

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body = await req.json() as { items: QueueItem[] }
  const { items } = body

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const admin = createAdminClient()
  const results: SyncResult[] = []

  for (const item of items) {
    try {
      const { local_id, project_id, payload } = item

      // Reject items missing weld_id_number
      const weld_id_number = payload.weld_id_number as string | undefined
      if (!weld_id_number) {
        results.push({ local_id, status: 'error', error: 'weld_id_number is required' })
        continue
      }

      // Verify project belongs to caller's org
      const { data: project } = await admin
        .from('projects')
        .select('id')
        .eq('id', project_id)
        .eq('organization_id', caller.organization_id)
        .maybeSingle()

      if (!project) {
        results.push({ local_id, status: 'error', error: 'Project not found' })
        continue
      }

      // Duplicate check by weld_id_number in same project
      const { data: existing } = await admin
        .from('welds')
        .select('id')
        .eq('project_id', project_id)
        .eq('weld_id_number', weld_id_number)
        .maybeSingle()

      if (existing) {
        results.push({ local_id, status: 'duplicate', weld_id: existing.id as string })
        continue
      }

      // Insert weld
      const { data: newWeld, error: insertError } = await admin
        .from('welds')
        .insert({
          ...payload,
          project_id,
          organization_id: caller.organization_id,
        })
        .select('id')
        .single()

      if (insertError) {
        results.push({ local_id, status: 'error', error: insertError.message })
      } else {
        results.push({ local_id, status: 'created', weld_id: newWeld.id as string })
      }
    } catch (err) {
      results.push({
        local_id: item.local_id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({ results })
}
