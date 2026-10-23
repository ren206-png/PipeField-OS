// ============================================================
// ISO Tap-to-Calculate — Butt-Weld Cut Length Strategy (1C)
// Pure TypeScript. Zero framework/DB/browser imports.
// ============================================================
// Lcut = T − A1 − A2 − g1 − g2
// No "safety allowances". Saw kerf is not finished length.
// ============================================================

import type { BwInput, BwResult, BwError } from './schemas'

function bwError(field: string, reason: string): BwError {
  return { kind: 'bw-error', field, reason }
}

export function computeBwCutLength(input: BwInput): BwResult | BwError {
  const { travel, fittingA, fittingB, gapA, gapB } = input

  // ── Validate travel ──────────────────────────────────────────────────────
  if (!isFinite(travel) || travel <= 0) {
    return bwError('travel', 'Travel must be a finite positive number (mm)')
  }

  // ── Validate fittings ────────────────────────────────────────────────────
  if (!fittingA.verified) {
    return bwError(
      'fittingA',
      `Fitting A (${fittingA.nominalSizeNps}, ${fittingA.angleDeg}°) has verified=false. Cut length requires a verified fitting record. Source: ${fittingA.sourceDoc}`,
    )
  }
  if (!fittingB.verified) {
    return bwError(
      'fittingB',
      `Fitting B (${fittingB.nominalSizeNps}, ${fittingB.angleDeg}°) has verified=false. Cut length requires a verified fitting record. Source: ${fittingB.sourceDoc}`,
    )
  }
  if (!isFinite(fittingA.deductionMm) || fittingA.deductionMm <= 0) {
    return bwError('fittingA.deductionMm', 'Fitting A deduction must be a finite positive number')
  }
  if (!isFinite(fittingB.deductionMm) || fittingB.deductionMm <= 0) {
    return bwError('fittingB.deductionMm', 'Fitting B deduction must be a finite positive number')
  }

  // ── Validate gaps ────────────────────────────────────────────────────────
  if (!gapA.confirmed) {
    return bwError(
      'gapA',
      'Root gap A must be explicitly confirmed (including zero — zero gap must not be assumed)',
    )
  }
  if (!gapB.confirmed) {
    return bwError(
      'gapB',
      'Root gap B must be explicitly confirmed (including zero — zero gap must not be assumed)',
    )
  }
  if (!isFinite(gapA.valueMm) || gapA.valueMm < 0) {
    return bwError('gapA.valueMm', 'Gap A must be a finite non-negative number')
  }
  if (!isFinite(gapB.valueMm) || gapB.valueMm < 0) {
    return bwError('gapB.valueMm', 'Gap B must be a finite non-negative number')
  }

  // ── Calculate ─────────────────────────────────────────────────────────────
  const A1 = fittingA.deductionMm
  const A2 = fittingB.deductionMm
  const g1 = gapA.valueMm
  const g2 = gapB.valueMm

  const cutLengthMm = travel - A1 - A2 - g1 - g2

  if (!isFinite(cutLengthMm)) {
    return bwError('cutLength', 'Computed cut length is non-finite')
  }
  if (cutLengthMm <= 0) {
    return bwError(
      'cutLength',
      `Computed cut length is ${cutLengthMm.toFixed(3)} mm — zero or negative lengths are not valid. ` +
        `Check travel (${travel} mm), deductions (A1=${A1}, A2=${A2}), and gaps (g1=${g1}, g2=${g2}).`,
    )
  }

  return {
    kind: 'bw-result',
    cutLengthMm,
    breakdown: {
      travel,
      deductionA: A1,
      deductionB: A2,
      gapA: g1,
      gapB: g2,
    },
  }
}
