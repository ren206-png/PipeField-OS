// ============================================================
// ISO Tap-to-Calculate — Fitting Catalog Adapter
// Pure adapter over existing ReferenceAdapter.
// No React, no browser API, no direct DB/network calls.
// ============================================================

import { z } from 'zod'
import type { ReferenceAdapter } from '@/lib/field-mode/calc/reference'
import type { CoverageReport } from './coverage-report'
import { buildCoverageReport } from './coverage-report'

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export const VerifiedBwDeductionSchema = z.object({
  kind: z.literal('verified-bw-deduction'),
  nominalSizeNps: z.string().min(1),
  angleDeg: z.number().finite().positive(),
  deductionMm: z.number().finite().positive(),
  standard: z.string(),
  sourceDoc: z.string(),
  edition: z.string(),
  verifiedBy: z.string(),
  verifiedAt: z.string(),
})
export type VerifiedBwDeduction = z.infer<typeof VerifiedBwDeductionSchema>

export const UnverifiedBwRecordSchema = z.object({
  kind: z.literal('unverified-bw-record'),
  nominalSizeNps: z.string().min(1),
  angleDeg: z.number().finite().positive(),
  deductionMm: z.number().finite().positive(),
  standard: z.string(),
  sourceDoc: z.string(),
  reason: z.literal('not-independently-verified'),
})
export type UnverifiedBwRecord = z.infer<typeof UnverifiedBwRecordSchema>

export const ThreadedFaceRecordSchema = z.object({
  kind: z.literal('threaded-face'),
  nominalSizeNps: z.string().min(1),
  angleDeg: z.number().finite().positive(),
  threadFamily: z.literal('NPT'),
  standard: z.enum(['ASME B16.3', 'ASME B16.11']),
  faceDistanceMm: z.number().finite().positive(),
  verified: z.boolean(),
  sourceDoc: z.string(),
  edition: z.string(),
})
export type ThreadedFaceRecord = z.infer<typeof ThreadedFaceRecordSchema>

export const NptThreadReferenceSchema = z.object({
  kind: z.literal('npt-thread-ref'),
  nominalSizeNps: z.string().min(1),
  tpi: z.number().finite().positive(),
  handTightL1Mm: z.number().finite().nonnegative(),
  effectiveThreadL2Mm: z.number().finite().nonnegative(),
  wrenchMakeupL3Mm: z.number().finite().nonnegative(),
  totalMakeupL1PlusL3Mm: z.number().finite().nonnegative(),
  verified: z.boolean(),
  note: z.literal('L1-plus-L3-is-not-insertion-depth'),
})
export type NptThreadReference = z.infer<typeof NptThreadReferenceSchema>

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface IsoCatalogAdapter {
  /** Returns verified BW deductions for a size+angle. Empty array = geometry only. */
  getBwDeductions(sizeNps: string, angleDeg: number): Promise<VerifiedBwDeduction[]>

  /** Returns all BW records (verified + unverified) for display. */
  getAllBwRecords(sizeNps: string, angleDeg: number): Promise<(VerifiedBwDeduction | UnverifiedBwRecord)[]>

  /** Returns threaded face records for size+angle+optional standard. */
  getThreadedFaceRecords(
    sizeNps: string,
    angleDeg: number,
    standard?: 'ASME B16.3' | 'ASME B16.11',
  ): Promise<ThreadedFaceRecord[]>

  /** Returns NPT thread reference data for a size. Informational only — NOT engagement. */
  getNptThreadReference(sizeNps: string): Promise<NptThreadReference | null>

  /** Returns the full coverage report across all sizes. */
  getCoverageReport(): Promise<CoverageReport>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a fitting_type string to an angle in degrees. Returns null for unknown. */
function fittingTypeToAngle(fittingType: string): number | null {
  const t = fittingType.toLowerCase()
  if (t.includes('90')) return 90
  if (t.includes('45')) return 45
  if (t.includes('22.5') || t.includes('22_5')) return 22.5
  if (t.includes('30')) return 30
  if (t.includes('60')) return 60
  return null
}

/** Normalise a standard string for B16.3/B16.11 classification. */
function classifyStandard(standard: string | null): 'ASME B16.3' | 'ASME B16.11' | null {
  if (!standard) return null
  if (standard.includes('B16.3')) return 'ASME B16.3'
  if (standard.includes('B16.11')) return 'ASME B16.11'
  return null
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createIsoCatalogAdapter(refAdapter: ReferenceAdapter): IsoCatalogAdapter {
  // Fetch all BW fittings for a size (all fitting_types) and classify
  async function fetchAllBwForSize(
    sizeNps: string,
  ): Promise<(VerifiedBwDeduction | UnverifiedBwRecord)[]> {
    // The existing adapter filters by fitting_type; pass no fitting_type to get all rows for the NPS.
    // fitting_type is optional in the API (undefined → no filter applied server-side).
    const rows = await refAdapter.getBwFitting({ nps: sizeNps, fitting_type: '' })
    const results: (VerifiedBwDeduction | UnverifiedBwRecord)[] = []

    for (const row of rows) {
      const angleDeg = fittingTypeToAngle(row.data.fitting_type)
      if (angleDeg === null) continue // unknown angle — skip

      const deductionMm = row.data.center_to_end_mm
      if (!deductionMm || deductionMm <= 0) continue

      if (row.verified) {
        const parsed = VerifiedBwDeductionSchema.safeParse({
          kind: 'verified-bw-deduction',
          nominalSizeNps: row.data.nps,
          angleDeg,
          deductionMm,
          standard: row.standard ?? 'ASME B16.9',
          sourceDoc: row.source_doc,
          edition: row.edition ?? '',
          // verified_by / verified_at live in the DB row but not in RefRow<T>
          // Use source_doc as provenance; row_id for traceability
          verifiedBy: row.row_id,
          verifiedAt: '',
        })
        if (parsed.success) results.push(parsed.data)
      } else {
        const parsed = UnverifiedBwRecordSchema.safeParse({
          kind: 'unverified-bw-record',
          nominalSizeNps: row.data.nps,
          angleDeg,
          deductionMm,
          standard: row.standard ?? '',
          sourceDoc: row.source_doc,
          reason: 'not-independently-verified',
        })
        if (parsed.success) results.push(parsed.data)
      }
    }
    return results
  }

  return {
    async getBwDeductions(sizeNps, angleDeg) {
      const all = await fetchAllBwForSize(sizeNps)
      return all.filter(
        (r): r is VerifiedBwDeduction =>
          r.kind === 'verified-bw-deduction' && Math.abs(r.angleDeg - angleDeg) < 0.01,
      )
    },

    async getAllBwRecords(sizeNps, angleDeg) {
      const all = await fetchAllBwForSize(sizeNps)
      return all.filter(r => Math.abs(r.angleDeg - angleDeg) < 0.01)
    },

    async getThreadedFaceRecords(sizeNps, angleDeg, standard) {
      const rows = await refAdapter.getThreadedFitting({ nps: sizeNps })
      const results: ThreadedFaceRecord[] = []

      for (const row of rows) {
        const std = classifyStandard(row.standard)
        if (!std) continue // non-NPT standard family — skip
        if (standard && std !== standard) continue // filter by requested standard

        // Determine face distance from the angle
        let faceDistanceMm: number | null = null
        if (Math.abs(angleDeg - 90) < 0.01) {
          faceDistanceMm = row.data.ctr_to_end_a_90_tee_mm ?? null
        } else if (Math.abs(angleDeg - 45) < 0.01) {
          faceDistanceMm = row.data.ctr_to_end_45_mm ?? null
        }
        if (!faceDistanceMm || faceDistanceMm <= 0) continue

        const parsed = ThreadedFaceRecordSchema.safeParse({
          kind: 'threaded-face',
          nominalSizeNps: row.data.nps,
          angleDeg,
          threadFamily: 'NPT',
          standard: std,
          faceDistanceMm,
          verified: row.verified,
          sourceDoc: row.source_doc,
          edition: row.edition ?? '',
        })
        if (parsed.success) results.push(parsed.data)
      }
      return results
    },

    async getNptThreadReference(sizeNps) {
      const rows = await refAdapter.getNptThread({ nps: sizeNps })
      if (rows.length === 0) return null
      const row = rows[0]

      const parsed = NptThreadReferenceSchema.safeParse({
        kind: 'npt-thread-ref',
        nominalSizeNps: row.data.nps,
        tpi: row.data.tpi ?? 0,
        handTightL1Mm: row.data.handtight_l1_mm ?? 0,
        effectiveThreadL2Mm: row.data.effective_thread_l2_mm ?? 0,
        wrenchMakeupL3Mm: (row.data.total_makeup_l1_plus_l3_in != null && row.data.handtight_l1_mm != null)
          ? (row.data.total_makeup_l1_plus_l3_in * 25.4) - row.data.handtight_l1_mm
          : 0,
        totalMakeupL1PlusL3Mm: row.data.total_makeup_l1_plus_l3_in != null
          ? row.data.total_makeup_l1_plus_l3_in * 25.4
          : 0,
        verified: row.verified,
        note: 'L1-plus-L3-is-not-insertion-depth' as const,
      })
      return parsed.success ? parsed.data : null
    },

    async getCoverageReport() {
      // Fetch all BW rows (no size/type filter — pass empty string, gets all)
      const bwRows = await fetchAllBwForSize('') // adapter may return all or empty; handled gracefully

      // Fetch threaded rows (no size filter)
      const threadedRowsRaw = await refAdapter.getThreadedFitting({ nps: '' })
      const threadedRows: ThreadedFaceRecord[] = []
      for (const row of threadedRowsRaw) {
        const std = classifyStandard(row.standard)
        if (!std) continue
        // Produce one record per angle per fitting
        for (const [angleDeg, field] of [
          [90, 'ctr_to_end_a_90_tee_mm'],
          [45, 'ctr_to_end_45_mm'],
        ] as const) {
          const faceDistanceMm = (row.data[field as keyof typeof row.data] as number | null) ?? null
          if (!faceDistanceMm || faceDistanceMm <= 0) continue
          const parsed = ThreadedFaceRecordSchema.safeParse({
            kind: 'threaded-face',
            nominalSizeNps: row.data.nps,
            angleDeg,
            threadFamily: 'NPT',
            standard: std,
            faceDistanceMm,
            verified: row.verified,
            sourceDoc: row.source_doc,
            edition: row.edition ?? '',
          })
          if (parsed.success) threadedRows.push(parsed.data)
        }
      }

      const nptRowsRaw = await refAdapter.getNptThread({ nps: '' })
      const nptRows: NptThreadReference[] = []
      for (const row of nptRowsRaw) {
        const parsed = NptThreadReferenceSchema.safeParse({
          kind: 'npt-thread-ref',
          nominalSizeNps: row.data.nps,
          tpi: row.data.tpi ?? 0,
          handTightL1Mm: row.data.handtight_l1_mm ?? 0,
          effectiveThreadL2Mm: row.data.effective_thread_l2_mm ?? 0,
          wrenchMakeupL3Mm: 0,
          totalMakeupL1PlusL3Mm: row.data.total_makeup_l1_plus_l3_in != null
            ? row.data.total_makeup_l1_plus_l3_in * 25.4
            : 0,
          verified: row.verified,
          note: 'L1-plus-L3-is-not-insertion-depth' as const,
        })
        if (parsed.success) nptRows.push(parsed.data)
      }

      return buildCoverageReport(bwRows, threadedRows, nptRows)
    },
  }
}
