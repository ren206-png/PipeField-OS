// ============================================================
// Intelligence Engine — Stubs
//
// All Phase 1 stubs have been promoted to active adapters
// in Phase 2. This file is retained as a placeholder for
// future capabilities that haven't been implemented yet.
//
// To add a new NOT_IMPLEMENTED capability:
//   1. Define its descriptor here using makeStub()
//   2. Export it and register it in registry.ts
//   3. Document it in INTELLIGENCE_ENGINE.md and FEATURE_FLAGS.md
// ============================================================
import type { CapabilityAdapter, CapabilityDescriptor, InvocationContext, AdapterResult } from '../types'

// Generic stub factory — kept for future capabilities
export function makeStub<TInput, TOutput>(
  descriptor: CapabilityDescriptor,
): CapabilityAdapter<TInput, TOutput> {
  return {
    descriptor,
    invoke(_ctx: InvocationContext, _input: TInput): Promise<AdapterResult<TOutput>> {
      throw new Error(
        `[Intelligence Engine] Capability "${descriptor.name}" is NOT_IMPLEMENTED. ` +
        `It will be built in a future phase.`
      )
    },
  }
}

// No active stubs — all 13 capabilities are now implemented.
