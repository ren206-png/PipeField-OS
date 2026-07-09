// ============================================================
// Intelligence Engine — AI Invocation Audit Log
//
// Writes to public.ai_invocations (created in migration
// 20260708_intelligence_engine.sql). This is the canonical
// audit trail for all Intelligence Engine invocations.
//
// Rule: do NOT log raw prompt content or customer data.
// Only metadata: capability, model, token counts, latency, status.
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'
import type { AiAuditEntry } from './types'

/**
 * Appends one invocation record to the ai_invocations audit log.
 * Uses the admin client (bypasses RLS) so the write always
 * succeeds even if the user session has expired.
 *
 * Fire-and-forget safe: never throws — errors are logged to console.
 */
export async function logInvocation(entry: AiAuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('ai_invocations').insert({
      organization_id: entry.organization_id,
      user_id:         entry.user_id ?? null,
      capability:      entry.capability,
      model:           entry.model,
      tokens_used:     entry.tokens_used,
      latency_ms:      entry.latency_ms,
      flag_state:      entry.flag_state,
      status:          entry.status,
      error_message:   entry.error_message ?? null,
    })
    if (error) {
      console.error('[intelligence.audit] logInvocation write failed:', error)
    }
  } catch (err) {
    console.error('[intelligence.audit] logInvocation unexpected error:', err)
  }
}
