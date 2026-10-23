// ============================================================
// ISO Tap-to-Calculate — Catalog adapter tests
// All test data is synthetic mock data — no real DB calls.
// ============================================================

import { createIsoCatalogAdapter } from '../fitting-catalog-adapter'
import { validateProjectEngagementRecord } from '../engagement-record'
import { buildCoverageReport } from '../coverage-report'
import type { VerifiedBwDeduction, UnverifiedBwRecord, ThreadedFaceRecord, NptThreadReference } from '../fitting-catalog-adapter'
import { makeMockRefAdapter, makeRefRow } from '@/lib/field-mode/calc/__tests__/mock-ref-adapter'
import type { BwFittingRow, ThreadedFittingRow, NptThreadRow } from '@/lib/field-mode/calc/reference'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBwRow(overrides: Partial<BwFittingRow> = {}, verified = false) {
  return makeRefRow<BwFittingRow>(
    {
      nps: '2',
      od_in: 2.375,
      od_mm: 60.3,
      fitting_type: '90-elbow-lr',
      dimension_label: 'A',
      center_to_end_in: 3.0,
      center_to_end_mm: 76.2,
      derived: false,
      standard: 'ASME B16.9',
      edition: '2018',
      ...overrides,
    },
    {
      verified,
      source_doc: verified ? 'ASME B16.9-2018 Table 1' : 'claude-memory-2026-08-24 (recall); NOT an independent source',
      standard: overrides.standard ?? 'ASME B16.9',
      edition: '2018',
    },
  )
}

function makeThreadedRow(nps: string, standard: string, verified = false) {
  return makeRefRow<ThreadedFittingRow>(
    {
      nps,
      ctr_to_end_a_90_tee_in: 1.5,
      ctr_to_end_a_90_tee_mm: 38.1,
      ctr_to_end_45_in: 1.0,
      ctr_to_end_45_mm: 25.4,
      thread_engagement_see: 'B1.20.1',
      standard,
      edition: '2011',
    },
    { verified, source_doc: 'claude-memory-2026-08-24 (recall)', standard, edition: '2011' },
  )
}

function makeNptRow(nps: string, verified = false) {
  return makeRefRow<NptThreadRow>(
    {
      nps,
      tpi: 14,
      pitch_in: 0.0714,
      pitch_mm: 1.814,
      pipe_od_in: 0.84,
      pipe_od_mm: 21.3,
      handtight_l1_in: 0.3611,
      handtight_l1_mm: 9.17,
      handtight_turns: 4.5,
      effective_thread_l2_in: 0.5337,
      effective_thread_l2_mm: 13.56,
      wrench_makeup_l3_in: 0.2500,
      wrench_makeup_turns: 3.5,
      total_makeup_l1_plus_l3_in: 0.6111,
      taper: '1/16 in/in',
      standard: 'ASME B1.20.1',
      edition: '2013',
    },
    { verified, source_doc: 'claude-memory-2026-08-24 (recall)', standard: 'ASME B1.20.1', edition: '2013' },
  )
}

// ---------------------------------------------------------------------------
// 1. BW verified/unverified split
// ---------------------------------------------------------------------------

describe('getBwDeductions — verified/unverified split', () => {
  it('returns only verified rows', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getBwFitting: async () => [
          makeBwRow({ nps: '2', fitting_type: '90-elbow-lr', center_to_end_mm: 76.2 }, true),
          makeBwRow({ nps: '2', fitting_type: '90-elbow-lr', center_to_end_mm: 76.2 }, false),
        ],
      }),
    )
    const result = await adapter.getBwDeductions('2', 90)
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('verified-bw-deduction')
  })

  it('returns all rows (verified + unverified) via getAllBwRecords', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getBwFitting: async () => [
          makeBwRow({ fitting_type: '90-elbow-lr' }, true),
          makeBwRow({ fitting_type: '90-elbow-lr' }, false),
        ],
      }),
    )
    const result = await adapter.getAllBwRecords('2', 90)
    expect(result).toHaveLength(2)
    const kinds = result.map(r => r.kind)
    expect(kinds).toContain('verified-bw-deduction')
    expect(kinds).toContain('unverified-bw-record')
  })

  it('getBwDeductions returns empty array when no verified rows — never throws', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getBwFitting: async () => [makeBwRow({}, false)],
      }),
    )
    const result = await adapter.getBwDeductions('2', 90)
    expect(result).toHaveLength(0)
  })

  it('filters by angle — 45° rows not returned for 90° query', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getBwFitting: async () => [
          makeBwRow({ fitting_type: '45-elbow', center_to_end_mm: 50 }, true),
        ],
      }),
    )
    const result = await adapter.getBwDeductions('2', 90)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2. B16.3 vs B16.11 filter
// ---------------------------------------------------------------------------

describe('getThreadedFaceRecords — B16.3 vs B16.11 filter', () => {
  it('returns only B16.3 rows when standard=ASME B16.3 requested', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getThreadedFitting: async () => [
          makeThreadedRow('1', 'ASME B16.3'),
          makeThreadedRow('1', 'ASME B16.11'),
        ],
      }),
    )
    const result = await adapter.getThreadedFaceRecords('1', 90, 'ASME B16.3')
    expect(result).toHaveLength(1)
    expect(result[0].standard).toBe('ASME B16.3')
  })

  it('returns only B16.11 rows when standard=ASME B16.11 requested', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getThreadedFitting: async () => [
          makeThreadedRow('1', 'ASME B16.3'),
          makeThreadedRow('1', 'ASME B16.11'),
        ],
      }),
    )
    const result = await adapter.getThreadedFaceRecords('1', 90, 'ASME B16.11')
    expect(result).toHaveLength(1)
    expect(result[0].standard).toBe('ASME B16.11')
  })

  it('returns both when no standard filter', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getThreadedFitting: async () => [
          makeThreadedRow('1', 'ASME B16.3'),
          makeThreadedRow('1', 'ASME B16.11'),
        ],
      }),
    )
    const result = await adapter.getThreadedFaceRecords('1', 90)
    expect(result).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 3. L1+L3 label enforced
// ---------------------------------------------------------------------------

describe('getNptThreadReference — L1+L3 label', () => {
  it('always returns note: L1-plus-L3-is-not-insertion-depth', async () => {
    const adapter = createIsoCatalogAdapter(
      makeMockRefAdapter({
        getNptThread: async () => [makeNptRow('1/2')],
      }),
    )
    const result = await adapter.getNptThreadReference('1/2')
    expect(result).not.toBeNull()
    expect(result!.note).toBe('L1-plus-L3-is-not-insertion-depth')
  })

  it('returns null when no rows', async () => {
    const adapter = createIsoCatalogAdapter(makeMockRefAdapter())
    const result = await adapter.getNptThreadReference('99')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. Coverage report at pilot state (all unverified)
// ---------------------------------------------------------------------------

describe('Coverage report', () => {
  it('returns geometry-only when all rows unverified', () => {
    const bwRows: UnverifiedBwRecord[] = [
      {
        kind: 'unverified-bw-record',
        nominalSizeNps: '2',
        angleDeg: 90,
        deductionMm: 76.2,
        standard: 'ASME B16.9',
        sourceDoc: 'claude-memory-2026-08-24',
        reason: 'not-independently-verified',
      },
    ]
    const report = buildCoverageReport(bwRows, [], [])
    expect(report.summary).toBe('geometry-only')
    expect(report.bwCoverage.verifiedRows).toBe(0)
    expect(report.bwCoverage.missingDataNote).toBeTruthy()
    expect(report.threadedCoverage.missingDataNote).toBeTruthy()
    expect(report.threadedCoverage.engagementRoute).toBe('route-2-project-entered-only')
  })

  it('returns cut-length-ready when at least one verified BW row exists', () => {
    const bwRows: VerifiedBwDeduction[] = [
      {
        kind: 'verified-bw-deduction',
        nominalSizeNps: '2',
        angleDeg: 90,
        deductionMm: 76.2,
        standard: 'ASME B16.9',
        sourceDoc: 'ASME B16.9-2018',
        edition: '2018',
        verifiedBy: 'engineer-123',
        verifiedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const report = buildCoverageReport(bwRows, [], [])
    expect(report.summary).toBe('cut-length-ready')
    expect(report.bwCoverage.verifiedRows).toBe(1)
    expect(report.bwCoverage.cutLengthReadySizes).toContain('2')
  })

  it('geometryOnlySizes contains sizes with zero verified rows', () => {
    const bwRows: UnverifiedBwRecord[] = [
      { kind: 'unverified-bw-record', nominalSizeNps: '3', angleDeg: 90, deductionMm: 90, standard: '', sourceDoc: '', reason: 'not-independently-verified' },
      { kind: 'unverified-bw-record', nominalSizeNps: '4', angleDeg: 45, deductionMm: 80, standard: '', sourceDoc: '', reason: 'not-independently-verified' },
    ]
    const report = buildCoverageReport(bwRows, [], [])
    expect(report.bwCoverage.geometryOnlySizes).toContain('3')
    expect(report.bwCoverage.geometryOnlySizes).toContain('4')
    expect(report.bwCoverage.totalRows).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 5. Project engagement record validation
// ---------------------------------------------------------------------------

const validRecord = {
  id: 'rec-001',
  threadFamily: 'NPT' as const,
  nominalSizeNps: '1/2',
  standard: 'ASME B16.3' as const,
  fittingDescription: 'Anvil 3000# 90° elbow, 1/2 NPT',
  valueMm: 12,
  rangeMinMm: 11,
  rangeMaxMm: 13,
  basis: 'project-entered' as const,
  sourceDescription: 'Anvil International catalogue P-4001, Table 3',
  sourceType: 'manufacturer-data' as const,
  confirmedByUserId: 'user-abc',
  confirmedByUserName: 'J. Smith',
  confirmedAt: '2026-10-23T00:00:00.000Z',
  organizationId: 'org-xyz',
  label: 'Project-entered values' as const,
}

describe('ProjectEngagementRecord validation', () => {
  it('accepts a valid record', () => {
    expect(() => validateProjectEngagementRecord(validRecord)).not.toThrow()
  })

  it('rejects empty sourceDescription', () => {
    expect(() =>
      validateProjectEngagementRecord({ ...validRecord, sourceDescription: '' }),
    ).toThrow()
  })

  it('rejects valueMm below rangeMinMm', () => {
    expect(() =>
      validateProjectEngagementRecord({ ...validRecord, valueMm: 9, rangeMinMm: 11, rangeMaxMm: 13 }),
    ).toThrow()
  })

  it('rejects valueMm above rangeMaxMm', () => {
    expect(() =>
      validateProjectEngagementRecord({ ...validRecord, valueMm: 15, rangeMinMm: 11, rangeMaxMm: 13 }),
    ).toThrow()
  })

  it('rejects unknown threadFamily', () => {
    expect(() =>
      validateProjectEngagementRecord({ ...validRecord, threadFamily: 'BSPT' }),
    ).toThrow()
  })

  it('rejects negative valueMm', () => {
    expect(() =>
      validateProjectEngagementRecord({ ...validRecord, valueMm: -5, rangeMinMm: -10, rangeMaxMm: -1 }),
    ).toThrow()
  })

  it('rejects invalid confirmedAt date', () => {
    expect(() =>
      validateProjectEngagementRecord({ ...validRecord, confirmedAt: 'not-a-date' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// 6. Type isolation — BW types carry no threaded state; threaded carry no BW state
// ---------------------------------------------------------------------------

describe('Type isolation', () => {
  it('VerifiedBwDeduction has no engagement, gap, or threaded fields', () => {
    const record: VerifiedBwDeduction = {
      kind: 'verified-bw-deduction',
      nominalSizeNps: '2',
      angleDeg: 90,
      deductionMm: 76.2,
      standard: 'ASME B16.9',
      sourceDoc: 'test',
      edition: '2018',
      verifiedBy: 'tester',
      verifiedAt: '2026-01-01T00:00:00Z',
    }
    expect('engagement' in record).toBe(false)
    expect('gapA' in record).toBe(false)
    expect('gapB' in record).toBe(false)
    expect('faceDistanceMm' in record).toBe(false)
  })

  it('ProjectEngagementRecord has no deductionMm, gapA, gapB fields', () => {
    const record = validateProjectEngagementRecord(validRecord)
    expect('deductionMm' in record).toBe(false)
    expect('gapA' in record).toBe(false)
    expect('gapB' in record).toBe(false)
  })
})
