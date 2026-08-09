// ============================================================
// POST /api/cron/support-photo-cleanup
// Daily job: hard-delete photos past their delete_after deadline.
// Auth: CRON_SECRET Bearer token (same pattern as health-monitor cron).
// Idempotent. Audit-logs each deletion.
// Uses service role (createAdminClient) to bypass RLS for deletion.
//
// NOTE: The UPDATE on support_photo_identifications (setting deleted_at)
// intentionally bypasses the "no UPDATE policy" on that table.
// This is correct and intentional — the deletion job runs as the Supabase
// service role (via createAdminClient), which operates above RLS.
// The append-only constraint is enforced at the user/API layer only.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── 1. Verify CRON_SECRET ─────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date().toISOString()

  // ── 2. Query expired rows ─────────────────────────────────
  const { data: rows, error: queryError } = await admin
    .from('support_photo_identifications')
    .select('id, organization_id, storage_path, client_photo_id')
    .lte('delete_after', now)
    .is('deleted_at', null)

  if (queryError) {
    console.error('[support-photo-cleanup] Query failed:', queryError.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let deletedCount = 0

  // ── 3. Process each expired row ───────────────────────────
  for (const row of rows ?? []) {
    try {
      // a. Delete from Supabase Storage
      if (row.storage_path) {
        const { error: storageError } = await admin.storage
          .from('support-photos')
          .remove([row.storage_path as string])

        if (storageError) {
          console.error(
            `[support-photo-cleanup] Storage delete failed for id=${row.id}:`,
            storageError.message,
          )
          // Continue — still mark as deleted so we don't retry endlessly
        }
      }

      // b. Mark row as deleted (service role bypasses RLS — intentional, see file header)
      const { error: updateError } = await admin
        .from('support_photo_identifications')
        .update({ deleted_at: now })
        .eq('id', row.id as string)
        .eq('organization_id', row.organization_id as string)

      if (updateError) {
        console.error(
          `[support-photo-cleanup] Row update failed for id=${row.id}:`,
          updateError.message,
        )
        continue
      }

      // c. Log deletion (no PII — only IDs and timestamps)
      logger.info('support-photo-cleanup.deleted', { id: row.id, organization_id: row.organization_id, deleted_at: now })

      deletedCount++
    } catch (err) {
      console.error(`[support-photo-cleanup] Unexpected error for id=${row.id}:`, err)
    }
  }

  return NextResponse.json({ deleted_count: deletedCount })
}
