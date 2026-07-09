// ============================================================
// Intelligence Engine — Core Types
// ============================================================

// ── Capabilities ─────────────────────────────────────────────
// All 12 target capabilities from the architectural brief.
// Only capabilities with existing implementations are ACTIVE in Phase 1.
// All others are registered as NOT_IMPLEMENTED stubs.
export type CapabilityName =
  | 'rag-qa'               // Active — wraps /api/knowledge/ask
  | 'document-embedding'   // Active — wraps /api/knowledge/process/[id]
  | 'pipefitter-assistant' // NOT_IMPLEMENTED
  | 'drawing-analysis'     // NOT_IMPLEMENTED
  | 'welding-guidance'     // NOT_IMPLEMENTED
  | 'qa-qc-assistance'     // NOT_IMPLEMENTED
  | 'safety-analysis'      // NOT_IMPLEMENTED
  | 'fabrication-planning' // NOT_IMPLEMENTED
  | 'material-takeoff'     // NOT_IMPLEMENTED
  | 'estimating'           // NOT_IMPLEMENTED
  | 'scheduling'           // NOT_IMPLEMENTED
  | 'inspection'           // NOT_IMPLEMENTED
  | 'digital-twin'         // NOT_IMPLEMENTED

export type CapabilityStatus = 'ACTIVE' | 'NOT_IMPLEMENTED'

// Per-tier daily token budget for each capability (across all users in the org).
// null = unlimited.
export type TierTokenBudget = {
  free_trial:   number
  field_pro:    number
  starter:      number
  professional: number
  enterprise:   number | null
}

export interface CapabilityDescriptor {
  name:              CapabilityName
  status:            CapabilityStatus
  // Minimum subscription tier required to use this capability.
  // Empty array = available to all tiers.
  requiredTiers:     string[]
  dailyTokenBudget:  TierTokenBudget
}

// ── Invocation context ────────────────────────────────────────
// Passed from the route handler into every adapter call.
export interface InvocationContext {
  organizationId: string
  userId:         string          // user_profiles.id (not auth_user_id)
  authUserId:     string          // auth.uid()
  capability:     CapabilityName
  flagState:      Record<string, boolean>
}

// ── Adapter interface ────────────────────────────────────────
// Every capability must implement this contract.
// TInput and TOutput are capability-specific.
export interface CapabilityAdapter<TInput, TOutput> {
  descriptor: CapabilityDescriptor
  invoke(ctx: InvocationContext, input: TInput): Promise<AdapterResult<TOutput>>
}

// ── Adapter result ────────────────────────────────────────────
export interface AdapterResult<T> {
  data:        T
  tokensUsed:  number
  latencyMs:   number
  model:       string
}

// ── Accounting ───────────────────────────────────────────────
export interface DailyUsage {
  organizationId:  string
  capability:      CapabilityName
  tokensToday:     number
  budget:          number | null  // null = unlimited
  withinBudget:    boolean
}

// ── Audit log entry ──────────────────────────────────────────
export interface AiAuditEntry {
  organization_id: string
  user_id:         string | null
  capability:      string
  model:           string
  tokens_used:     number
  latency_ms:      number
  flag_state:      Record<string, boolean>
  status:          'success' | 'error' | 'rate_limited' | 'tier_blocked'
  error_message?:  string
}

// ── Registry result ──────────────────────────────────────────
// Returned to callers by the capability registry.
export type RegistryResult<T> =
  | { ok: true;  data: T; tokensUsed: number; latencyMs: number; model: string }
  | { ok: false; reason: 'not_implemented' | 'tier_blocked' | 'budget_exceeded' | 'engine_disabled' | 'error'; message: string }
