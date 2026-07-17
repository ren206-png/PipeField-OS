// src/lib/weld-events.ts
// Helper for writing to the immutable weld_events ledger.
// Import this wherever a QC-significant action occurs.

import { createAdminClient } from '@/lib/supabase/admin'

export type WeldEventType =
  | 'created'
  | 'status_changed'
  | 'qual_checked'
  | 'qual_passed'
  | 'qual_flagged'
  | 'qual_blocked'
  | 'qual_overridden'
  | 'nde_selected'
  | 'nde_result_pass'
  | 'nde_result_fail'
  | 'nde_progressive_penalty'
  | 'heat_assigned'
  | 'continuity_checked'
  | 'continuity_passed'
  | 'continuity_flagged'
  | 'repair_linked'
  | 'turnover_included'

export interface WeldEventPayload {
  organizationId: string
  weldId:         string
  eventType:      WeldEventType
  actorId:        string
  actorRole:      string
  fromStatus?:    string
  toStatus?:      string
  reason?:        string
  metadata?:      Record<string, unknown>
}

/**
 * Append an event to the weld_events ledger.
 * Never throws — errors are logged but do not block the main operation.
 * The ledger is best-effort audit trail; a write failure should not
 * prevent a weld from being saved.
 */
export async function writeWeldEvent(payload: WeldEventPayload): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('weld_events').insert({
      organization_id: payload.organizationId,
      weld_id:         payload.weldId,
      event_type:      payload.eventType,
      actor_id:        payload.actorId,
      actor_role:      payload.actorRole,
      from_status:     payload.fromStatus ?? null,
      to_status:       payload.toStatus ?? null,
      reason:          payload.reason ?? null,
      metadata:        payload.metadata ?? {},
    })
    if (error) {
      console.error('[weld-events] Failed to write event:', error.message, payload)
    }
  } catch (err) {
    console.error('[weld-events] Unexpected error:', err, payload)
  }
}

/**
 * Retrieve the event history for a weld, newest first.
 */
export async function getWeldEvents(weldId: string, organizationId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('weld_events')
    .select('*')
    .eq('weld_id', weldId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}
