// ============================================================
// POST /api/spools/sync-queue
// Syncs offline-captured spools to the database.
//
// Duplicate detection: spool_number + project_id uniqueness.
// If a spool with the same number already exists in the project,
// returns 'duplicate' — client marks it synced (no double-insert).
//
// Guards:
//   - requireAuth
//   - OFFLINE_FIELD_ENABLED flag
//   - project must belong to caller's org
//   - max 50 items per request
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFLINE_FIELD_ENABLED } from '@/intelligence/flags'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ItemSchema = z.object({
  local_id:   z.string().uuid(),
  project_id: z.string().uuid(),
  payload:    z.record(z.unknown()),
})

const BodySchema = z.object({
  items: z.array(ItemSchema).max(50),
})

interface SyncResult {
  local_id:   string
  status:     'created' | 'duplicate' | 'error'
  spool_id?:  string
  error?:     string
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

  const raw    = await req.json()
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }
  const { items } = parsed.data
  if (items.length === 0) return NextResponse.json({ results: [] })

  const admin   = createAdminClient()
  const results: SyncResult[] = []

  for (const item of items) {
    try {
      const { local_id, project_id, payload } = item

      const spool_number = payload.spool_number as string | undefined
      if (!spool_number) {
        results.push({ local_id, status: 'error', error: 'spool_number is required' })
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

      // Duplicate check: same project + same spool number
      const { data: existing } = await admin
        .from('spools')
        .select('id')
        .eq('project_id', project_id)
        .eq('spool_number', spool_number)
        .eq('organization_id', caller.organization_id)
        .maybeSingle()

      if (existing) {
        results.push({ local_id, status: 'duplicate', spool_id: existing.id as string })
        continue
      }

      // Insert
      const { data: newSpool, error: insertErr } = await admin
        .from('spools')
        .insert({
          ...payload,
          project_id,
          organization_id: caller.organization_id,
          created_by: caller.auth_user_id,
        })
        .select('id')
        .single()

      if (insertErr) {
        results.push({ local_id, status: 'error', error: insertErr.message })
      } else {
        results.push({ local_id, status: 'created', spool_id: newSpool.id as string })
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
