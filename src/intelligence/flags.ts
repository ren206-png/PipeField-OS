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

  // ── Phase 1 Module flags ──────────────────────────────────
  // Module 1: Welder Qualification + Continuity Enforcement
  // Tenant modes: HARD_BLOCK or FLAG (configurable per org in org_settings)
  PFOS_QUAL_ENFORCEMENT:                   process.env.PFOS_QUAL_ENFORCEMENT                   === 'true',

  // Module 2: NDE Engine — deterministic weld selection for NDE programs
  PFOS_NDE_ENGINE:                         process.env.PFOS_NDE_ENGINE                         === 'true',

  // Module 3: Material Traceability — batch recall, heat number tracking
  PFOS_MATERIAL_TRACE:                     process.env.PFOS_MATERIAL_TRACE                     === 'true',

  // Welder plan limit enforcement (P0-FIX-2 — defaults ON to close gap).
  // Set PFOS_BILLING_WELDER_LIMIT=false to disable during rollback.
  PFOS_BILLING_WELDER_LIMIT:           process.env.PFOS_BILLING_WELDER_LIMIT           !== 'false',

  // Module 5A: Excel I/O — field-ready spreadsheet export + import
  PFOS_OFFLINE_FIELD:                  process.env.PFOS_OFFLINE_FIELD                  === 'true',

  // Module 4: Turnover Generator — package assembly with gap check + content hash
  PFOS_TURNOVER_GEN:                   process.env.PFOS_TURNOVER_GEN                   === 'true',

  // Phase 3: Pipe Support Photo-ID — advisory component identification from photo
  PFOS_SUPPORT_PHOTO_ID:               process.env.PFOS_SUPPORT_PHOTO_ID               === 'true',

  // ── Billing: Free Trial integration ──────────────────────────
  // Phase 1: Trial billing fields, webhook hardening, idempotency.
  // Phases 2-4: trial creation, cron notifications, grace period enforcement.
  PFOS_TRIAL_BILLING:                  process.env.PFOS_TRIAL_BILLING                  === 'true',

  // ── Field Mode module (PipeField OS Field Mode master prompt) ──
  // Master switch — reference library, calculator, field UI, and
  // personal log are each gated by their own sub-flag below, but all
  // of them are no-ops while this is OFF. Phase 1 (this migration)
  // ships schema + importer only, no UI — every Field Mode flag
  // defaults OFF and stays OFF until its owning phase is approved.
  PFOS_FIELD_MODE:                     process.env.PFOS_FIELD_MODE                     === 'true',

  // Phase 1: reference library (24 recall + 17 pocket-tradesman
  // tables, verification workflow). No UI yet — this flag guards the
  // future reference-browsing surface, not the importer/verify-ref
  // CLIs (which are unconditional standalone scripts).
  PFOS_FIELD_REFERENCE:                process.env.PFOS_FIELD_REFERENCE                === 'true',

  // Phase 2: calculator engine (mm-internal, imperial display).
  PFOS_FIELD_CALC:                     process.env.PFOS_FIELD_CALC                     === 'true',

  // Phase 3: Field Mode UI shell (scan/lookup log).
  PFOS_FIELD_SCAN_LOG:                 process.env.PFOS_FIELD_SCAN_LOG                 === 'true',

  // Phase 4: personal log.
  PFOS_FIELD_PERSONAL_LOG:             process.env.PFOS_FIELD_PERSONAL_LOG             === 'true',

  // Phase 4: voice notes capture on the personal log.
  PFOS_FIELD_VOICE_NOTES:              process.env.PFOS_FIELD_VOICE_NOTES              === 'true',

  // Owner-facing console for reviewing/approving ref_verification_events
  // and resolving DATA_SOURCE_MANIFEST gaps in-app (post-Phase-1 UI).
  PFOS_FIELD_REF_VERIFY_CONSOLE:       process.env.PFOS_FIELD_REF_VERIFY_CONSOLE        === 'true',
} as const

export type FlagName = keyof typeof FLAGS

export function isFlagEnabled(flag: FlagName): boolean {
  return FLAGS[flag]
}

/** Returns a snapshot of all current flag states (safe to log — no PII). */
export function getFlagSnapshot(): Record<FlagName, boolean> {
  return { ...FLAGS }
}

export const SUPPORT_PHOTO_ID_ENABLED    = isFlagEnabled('PFOS_SUPPORT_PHOTO_ID')
export const NDE_ENGINE_ENABLED          = isFlagEnabled('PFOS_NDE_ENGINE')
export const OFFLINE_FIELD_ENABLED       = isFlagEnabled('PFOS_OFFLINE_FIELD')
export const TURNOVER_GEN_ENABLED        = isFlagEnabled('PFOS_TURNOVER_GEN')
export const MATERIAL_TRACE_ENABLED      = isFlagEnabled('PFOS_MATERIAL_TRACE')
export const QUAL_ENFORCEMENT_ENABLED    = isFlagEnabled('PFOS_QUAL_ENFORCEMENT')
export const TRIAL_BILLING_ENABLED       = isFlagEnabled('PFOS_TRIAL_BILLING')
