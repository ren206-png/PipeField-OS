// ============================================================
// ISO Tap-to-Calculate — Data Coverage Report
// Describes which size/angle/family combos have verified data.
// ============================================================

import type { VerifiedBwDeduction, UnverifiedBwRecord, ThreadedFaceRecord, NptThreadReference } from './fitting-catalog-adapter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoverageReport {
  generatedAt: string

  bwCoverage: {
    totalRows: number
    verifiedRows: number
    geometryOnlySizes: string[]
    cutLengthReadySizes: string[]
    missingDataNote: string
  }

  threadedCoverage: {
    totalFittingRows: number
    verifiedFittingRows: number
    totalNptThreadRows: number
    verifiedNptThreadRows: number
    engagementRoute: 'route-2-project-entered-only'
    missingDataNote: string
    whatWouldUnblockCutLength: string
  }

  summary: 'geometry-only' | 'cut-length-ready'
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildCoverageReport(
  bwRows: (VerifiedBwDeduction | UnverifiedBwRecord)[],
  threadedRows: ThreadedFaceRecord[],
  nptRows: NptThreadReference[],
): CoverageReport {
  // BW coverage
  const verifiedBwRows = bwRows.filter(r => r.kind === 'verified-bw-deduction')
  const unverifiedBwRows = bwRows.filter(r => r.kind === 'unverified-bw-record')

  const verifiedBwSizes = new Set(verifiedBwRows.map(r => r.nominalSizeNps))
  const unverifiedOnlySizes = new Set(
    unverifiedBwRows
      .filter(r => !verifiedBwSizes.has(r.nominalSizeNps))
      .map(r => r.nominalSizeNps),
  )

  // Threaded coverage
  const verifiedThreadedRows = threadedRows.filter(r => r.verified)
  const verifiedNptRows = nptRows.filter(r => r.verified)

  const hasCutLengthReady = verifiedBwRows.length > 0

  return {
    generatedAt: new Date().toISOString(),

    bwCoverage: {
      totalRows: bwRows.length,
      verifiedRows: verifiedBwRows.length,
      geometryOnlySizes: Array.from(unverifiedOnlySizes).sort(),
      cutLengthReadySizes: Array.from(verifiedBwSizes).sort(),
      missingDataNote:
        'All BW rows sourced from claude-memory-2026-08-24; not independently verified. ' +
        'Cut length unavailable until rows are verified against ASME B16.9 source.',
    },

    threadedCoverage: {
      totalFittingRows: threadedRows.length,
      verifiedFittingRows: verifiedThreadedRows.length,
      totalNptThreadRows: nptRows.length,
      verifiedNptThreadRows: verifiedNptRows.length,
      engagementRoute: 'route-2-project-entered-only',
      missingDataNote:
        'No verified fitting or thread data. Threaded cut length requires project-entered ' +
        'engagement values with named source.',
      whatWouldUnblockCutLength:
        'To enable Route 1 (verified catalog) for threaded cut length: ' +
        '(1) Obtain manufacturer dimensional data for each fitting (centre-to-face F, per product and class) ' +
        'from an authoritative source such as a product catalogue or ASME B16.3/B16.11 table. ' +
        '(2) Obtain final assembled insertion depth (E) for each size from the same source or a documented ' +
        'measured assembly — this is distinct from L1 (hand-tight) or L1+L3 (total makeup). ' +
        '(3) Update each ref_threaded_fittings and ref_npt_threads row with verified=true, ' +
        'verified_by, verified_against (source document), and verified_at. ' +
        '(4) Populate a new engagement catalog table (or extend the existing) with per-product E values. ' +
        'Until then, Route 2 (project-entered values with named source) is the only path.',
    },

    summary: hasCutLengthReady ? 'cut-length-ready' : 'geometry-only',
  }
}
