// ============================================================
// Spool auto-release
// Called after a weld is accepted. If ALL welds on the spool
// are now accepted, advances spool status to 'released' and
// fires an in-app notification.
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

export async function autoReleaseSpoolIfComplete({
  weldId,
  orgId,
  admin = createAdminClient(),
}: {
  weldId: string
  orgId:  string
  admin?: ReturnType<typeof createAdminClient>
}): Promise<void> {
  // 1. Find the spool this weld belongs to
  const { data: weld } = await admin
    .from('welds')
    .select('spool_id')
    .eq('id', weldId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!weld?.spool_id) return  // weld not linked to a spool

  const spoolId = weld.spool_id

  // 2. Check current spool status — only auto-release if it's in fabrication/fit_up/welded
  const { data: spool } = await admin
    .from('spools')
    .select('id, spool_number, status')
    .eq('id', spoolId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!spool) return
  // Don't override already-released or higher statuses
  if (['released', 'installed'].includes(spool.status)) return

  // 3. Check all welds on this spool
  const { data: spoolWelds } = await admin
    .from('welds')
    .select('status')
    .eq('spool_id', spoolId)
    .eq('organization_id', orgId)

  if (!spoolWelds || spoolWelds.length === 0) return

  const allAccepted = spoolWelds.every(w => w.status === 'accepted')
  if (!allAccepted) return

  // 4. All welds accepted — release the spool
  await admin
    .from('spools')
    .update({ status: 'released', updated_at: new Date().toISOString() })
    .eq('id', spoolId)
    .eq('organization_id', orgId)

  // 5. Fire notification
  await createNotification({
    organizationId: orgId,
    type:  'spool_released',
    title: `Spool Released: ${spool.spool_number}`,
    body:  `All welds accepted — spool ${spool.spool_number} automatically released`,
    href:  `/spools/${spoolId}`,
  })
}
