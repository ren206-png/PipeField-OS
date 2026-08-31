// ============================================================
// Mock Reference Adapter for tests
// ============================================================

import type { ReferenceAdapter } from '../reference'
import type { RefRow } from '../types'

export function makeMockRefAdapter(overrides?: Partial<ReferenceAdapter>): ReferenceAdapter {
  const base: ReferenceAdapter = {
    getBwFitting: async () => [],
    getFlange: async () => [],
    getReducingTeeOutlet: async () => [],
    getSwFitting: async () => [],
    getSwCoupling: async () => [],
    getThreadedFitting: async () => [],
    getNptThread: async () => [],
    getStudBolt: async () => [],
    getWrenchSize: async () => [],
    getShackle: async () => [],
    getSlingLegFactor: async () => [],
    getSnatchBlockFactor: async () => [],
    getWireRopeSling: async () => [],
    getSyntheticSling: async () => [],
    getChainSling: async () => [],
    getMaterialWeight: async () => [],
    getPlateSteelWeight: async () => [],
  }
  return { ...base, ...overrides }
}

export function makeRefRow<T>(data: T, overrides?: Partial<RefRow<T>>): RefRow<T> {
  return {
    data,
    row_id: 'test-row-id',
    verified: true,
    recall_confidence: 'high',
    source_doc: 'test',
    standard: 'ASME',
    edition: '2018',
    ...overrides,
  }
}
