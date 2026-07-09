// ============================================================
// Intelligence Engine — Capability Registry
//
// Single entry point for all AI capability invocations.
// Enforces:
//   1. Master flag gate (PFOS_INTELLIGENCE_ENGINE_ENABLED)
//   2. Capability status (NOT_IMPLEMENTED → reject immediately)
//   3. Tier access (reuses existing subscription-tier logic)
//   4. Daily token budget (when PFOS_INTELLIGENCE_COST_CONTROLS ON)
//   5. Invocation → AI audit log write
//
// Existing API routes (/api/knowledge/ask, /api/knowledge/process/[id])
// are UNCHANGED in Phase 1. They continue to function independently.
// Old call sites migrate to registry.invoke() only after adapter
// equivalence is proven — never deleted in this phase.
// ============================================================
import type { CapabilityName, CapabilityAdapter, InvocationContext, RegistryResult } from './types'
import { isFlagEnabled, getFlagSnapshot } from './flags'
import { getOrgTier, isTierAllowed, tierBlockedMessage } from './tier'
import { getDailyUsage, budgetExhaustedMessage } from './accounting'
import { logInvocation } from './audit'

// ── Adapter imports ───────────────────────────────────────────
// Phase 1 — active adapters
import { ragQaAdapter }               from './adapters/rag-qa'
import { documentEmbeddingAdapter }   from './adapters/document-embedding'
// Phase 2 — all capabilities now active
import { weldingGuidanceAdapter }     from './adapters/welding-guidance'
import { safetyAnalysisAdapter }      from './adapters/safety-analysis'
import { qaQcAssistanceAdapter }      from './adapters/qa-qc-assistance'
import { pipefitterAssistantAdapter } from './adapters/pipefitter-assistant'
import { materialTakeoffAdapter }     from './adapters/material-takeoff'
import { inspectionAdapter }          from './adapters/inspection'
import { fabricationPlanningAdapter } from './adapters/fabrication-planning'
import { estimatingAdapter }          from './adapters/estimating'
import { schedulingAdapter }          from './adapters/scheduling'
import { drawingAnalysisAdapter }     from './adapters/drawing-analysis'
import { digitalTwinAdapter }         from './adapters/digital-twin'

// ── Capability registry map ───────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY = new Map<CapabilityName, CapabilityAdapter<any, any>>([
  // Phase 1
  ['rag-qa',               ragQaAdapter],
  ['document-embedding',   documentEmbeddingAdapter],
  // Phase 2 — priority order
  ['welding-guidance',     weldingGuidanceAdapter],
  ['safety-analysis',      safetyAnalysisAdapter],
  ['qa-qc-assistance',     qaQcAssistanceAdapter],
  ['pipefitter-assistant', pipefitterAssistantAdapter],
  ['material-takeoff',     materialTakeoffAdapter],
  ['inspection',           inspectionAdapter],
  ['fabrication-planning', fabricationPlanningAdapter],
  ['estimating',           estimatingAdapter],
  ['scheduling',           schedulingAdapter],
  ['drawing-analysis',     drawingAnalysisAdapter],
  ['digital-twin',         digitalTwinAdapter],
])

/**
 * Invoke a capability through the Intelligence Engine.
 *
 * Returns RegistryResult<T>:
 *   { ok: true,  data, tokensUsed, latencyMs, model }  — success
 *   { ok: false, reason, message }                      — blocked / failed
 *
 * Never throws — all errors are caught and returned as { ok: false }.
 *
 * @param capability - The capability to invoke
 * @param ctx        - Organization + user context (must be org-scoped)
 * @param input      - Capability-specific input
 */
export async function invoke<TInput, TOutput>(
  capability: CapabilityName,
  ctx:        InvocationContext,
  input:      TInput,
): Promise<RegistryResult<TOutput>> {
  const flagState = getFlagSnapshot()

  // ── 1. Master flag gate ───────────────────────────────────
  if (!isFlagEnabled('PFOS_INTELLIGENCE_ENGINE_ENABLED')) {
    return {
      ok:      false,
      reason:  'engine_disabled',
      message: 'The Intelligence Engine is not enabled on this environment.',
    }
  }

  // ── 2. Resolve adapter ────────────────────────────────────
  const adapter = REGISTRY.get(capability)
  if (!adapter) {
    return { ok: false, reason: 'not_implemented', message: `Unknown capability: ${capability}` }
  }

  // ── 3. NOT_IMPLEMENTED check ──────────────────────────────
  if (adapter.descriptor.status === 'NOT_IMPLEMENTED') {
    return {
      ok:      false,
      reason:  'not_implemented',
      message: `Capability "${capability}" is not yet implemented. It will be available in a future release.`,
    }
  }

  // ── 4. Tier gating (reuses existing plans.ts/usage.ts) ───
  const orgTier = await getOrgTier(ctx.organizationId)
  if (!isTierAllowed(adapter.descriptor, orgTier)) {
    await logInvocation({
      organization_id: ctx.organizationId,
      user_id:         ctx.userId,
      capability,
      model:           'none',
      tokens_used:     0,
      latency_ms:      0,
      flag_state:      flagState,
      status:          'tier_blocked',
    })
    return {
      ok:      false,
      reason:  'tier_blocked',
      message: tierBlockedMessage(adapter.descriptor),
    }
  }

  // ── 5. Daily token budget (when cost controls flag is ON) ─
  if (isFlagEnabled('PFOS_INTELLIGENCE_COST_CONTROLS')) {
    const usage = await getDailyUsage(ctx.organizationId, capability, orgTier)
    if (!usage.withinBudget) {
      await logInvocation({
        organization_id: ctx.organizationId,
        user_id:         ctx.userId,
        capability,
        model:           'none',
        tokens_used:     0,
        latency_ms:      0,
        flag_state:      flagState,
        status:          'rate_limited',
        error_message:   `Daily token budget exhausted (${usage.tokensToday}/${usage.budget})`,
      })
      return {
        ok:      false,
        reason:  'budget_exceeded',
        message: budgetExhaustedMessage(usage),
      }
    }
  }

  // ── 6. Invoke adapter ─────────────────────────────────────
  const invCtx: InvocationContext = { ...ctx, capability, flagState }
  const startTime = Date.now()

  try {
    const result = await adapter.invoke(invCtx, input)

    // ── 7. Audit log ─────────────────────────────────────────
    await logInvocation({
      organization_id: ctx.organizationId,
      user_id:         ctx.userId,
      capability,
      model:           result.model,
      tokens_used:     result.tokensUsed,
      latency_ms:      result.latencyMs,
      flag_state:      flagState,
      status:          'success',
    })

    return {
      ok:         true,
      data:       result.data as TOutput,
      tokensUsed: result.tokensUsed,
      latencyMs:  result.latencyMs,
      model:      result.model,
    }
  } catch (err) {
    const latencyMs     = Date.now() - startTime
    const errorMessage  = err instanceof Error ? err.message : String(err)

    await logInvocation({
      organization_id: ctx.organizationId,
      user_id:         ctx.userId,
      capability,
      model:           'unknown',
      tokens_used:     0,
      latency_ms:      latencyMs,
      flag_state:      flagState,
      status:          'error',
      error_message:   errorMessage,
    })

    return {
      ok:      false,
      reason:  'error',
      message: `Intelligence Engine error: ${errorMessage}`,
    }
  }
}

/**
 * Returns the descriptor for a capability without invoking it.
 * Useful for UI — showing which capabilities are available on the current plan.
 */
export function describe(capability: CapabilityName) {
  return REGISTRY.get(capability)?.descriptor ?? null
}

/**
 * Lists all registered capabilities and their current status.
 */
export function listCapabilities() {
  return Array.from(REGISTRY.values()).map(a => a.descriptor)
}
