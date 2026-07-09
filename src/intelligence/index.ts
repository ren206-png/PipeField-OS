// ============================================================
// PipeField Intelligence Engine — Public API
//
// Import from '@/intelligence' in server-side code only.
// Never import this module in client components — it uses
// server-only dependencies (Supabase admin, OpenAI key).
// ============================================================

// Primary entry point
export { invoke, describe, listCapabilities } from './registry'

// Flag helpers
export { isFlagEnabled, getFlagSnapshot, FLAGS } from './flags'
export type { FlagName } from './flags'

// Types
export type {
  CapabilityName,
  CapabilityStatus,
  CapabilityDescriptor,
  InvocationContext,
  RegistryResult,
  AdapterResult,
  DailyUsage,
  AiAuditEntry,
} from './types'

// Adapter input/output types (for route handlers that call the engine)
// Phase 1
export type { RagQaInput, RagQaOutput }                                           from './adapters/rag-qa'
export type { DocumentEmbeddingInput, DocumentEmbeddingOutput }                   from './adapters/document-embedding'
// Phase 2
export type { WeldingGuidanceInput, WeldingGuidanceOutput }                       from './adapters/welding-guidance'
export type { SafetyAnalysisInput, SafetyAnalysisOutput }                         from './adapters/safety-analysis'
export type { QaQcAssistanceInput, QaQcAssistanceOutput, QaQcMode }               from './adapters/qa-qc-assistance'
export type { PipefitterAssistantInput, PipefitterAssistantOutput }               from './adapters/pipefitter-assistant'
export type { MaterialTakeoffInput, MaterialTakeoffOutput }                       from './adapters/material-takeoff'
export type { InspectionInput, InspectionOutput }                                 from './adapters/inspection'
export type { FabricationPlanningInput, FabricationPlanningOutput }               from './adapters/fabrication-planning'
export type { EstimatingInput, EstimatingOutput }                                 from './adapters/estimating'
export type { SchedulingInput, SchedulingOutput }                                 from './adapters/scheduling'
export type { DrawingAnalysisInput, DrawingAnalysisOutput, DrawingType }          from './adapters/drawing-analysis'
export type { DigitalTwinInput, DigitalTwinOutput }                               from './adapters/digital-twin'
