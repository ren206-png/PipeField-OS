// ============================================================
// Intelligence Engine — Feature Flags
//
// All flags default to false/off. With all flags off the platform
// behaves byte-for-byte identically to the pre-Phase-1 state.
//
// See FEATURE_FLAGS.md at repo root for rollback procedures.
// ============================================================

export const FLAGS = {
  // Master switch. Must be ON before any capability is reachable
  // through the Intelligence Engine. All other flags are no-ops
  // when this is OFF.
  PFOS_INTELLIGENCE_ENGINE_ENABLED:    process.env.PFOS_INTELLIGENCE_ENGINE_ENABLED    === 'true',

  // Per-org daily token ceilings with graceful degradation.
  // Requires PFOS_INTELLIGENCE_ENGINE_ENABLED.
  PFOS_INTELLIGENCE_COST_CONTROLS:     process.env.PFOS_INTELLIGENCE_COST_CONTROLS     === 'true',

  // Cron job to re-process knowledge_sources with status='failed'.
  PFOS_KNOWLEDGE_RETRY_QUEUE:          process.env.PFOS_KNOWLEDGE_RETRY_QUEUE          === 'true',

  // ── Phase 2 capability flags ──────────────────────────────
  // Each maps to one adapter. All default OFF.
  // PFOS_INTELLIGENCE_ENGINE_ENABLED must be ON first.
  PFOS_INTELLIGENCE_WELDING_GUIDANCE:      process.env.PFOS_INTELLIGENCE_WELDING_GUIDANCE      === 'true',
  PFOS_INTELLIGENCE_SAFETY_ANALYSIS:       process.env.PFOS_INTELLIGENCE_SAFETY_ANALYSIS       === 'true',
  PFOS_INTELLIGENCE_QA_QC_ASSISTANCE:      process.env.PFOS_INTELLIGENCE_QA_QC_ASSISTANCE      === 'true',
  PFOS_INTELLIGENCE_PIPEFITTER_ASSISTANT:  process.env.PFOS_INTELLIGENCE_PIPEFITTER_ASSISTANT  === 'true',
  PFOS_INTELLIGENCE_MATERIAL_TAKEOFF:      process.env.PFOS_INTELLIGENCE_MATERIAL_TAKEOFF      === 'true',
  PFOS_INTELLIGENCE_INSPECTION:            process.env.PFOS_INTELLIGENCE_INSPECTION            === 'true',
  PFOS_INTELLIGENCE_FABRICATION_PLANNING:  process.env.PFOS_INTELLIGENCE_FABRICATION_PLANNING  === 'true',
  PFOS_INTELLIGENCE_ESTIMATING:            process.env.PFOS_INTELLIGENCE_ESTIMATING            === 'true',
  PFOS_INTELLIGENCE_SCHEDULING:            process.env.PFOS_INTELLIGENCE_SCHEDULING            === 'true',
  PFOS_INTELLIGENCE_DRAWING_ANALYSIS:      process.env.PFOS_INTELLIGENCE_DRAWING_ANALYSIS      === 'true',
  PFOS_INTELLIGENCE_DIGITAL_TWIN:          process.env.PFOS_INTELLIGENCE_DIGITAL_TWIN          === 'true',

  // Auto-prefill NCR / daily report forms from existing records (Phase 3).
  PFOS_AUTOMATION_PREFILL:                 process.env.PFOS_AUTOMATION_PREFILL                 === 'true',

  // Welder plan limit enforcement (P0-FIX-2 — defaults ON to close gap).
  // Set PFOS_BILLING_WELDER_LIMIT=false to disable during rollback.
  PFOS_BILLING_WELDER_LIMIT:           process.env.PFOS_BILLING_WELDER_LIMIT           !== 'false',
} as const

export type FlagName = keyof typeof FLAGS

export function isFlagEnabled(flag: FlagName): boolean {
  return FLAGS[flag]
}

/** Returns a snapshot of all current flag states (safe to log — no PII). */
export function getFlagSnapshot(): Record<FlagName, boolean> {
  return { ...FLAGS }
}
