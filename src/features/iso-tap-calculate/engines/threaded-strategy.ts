// ============================================================
// ISO Tap-to-Calculate — Threaded NPT Cut Length Strategy (1C)
// Pure TypeScript. Zero framework/DB/browser imports.
// ============================================================
// Definitions:
//   C  = axial distance between CL intersections
//   F1 = CL intersection → female port entry face (fitting 1)
//   F2 = CL intersection → female port entry face (fitting 2)
//   E1 = final assembled insertion depth (fitting 1) — Route 2 project-entered
//   E2 = final assembled insertion depth (fitting 2)
//   D1 = F1 - E1  (effective deduction, end 1)
//   D2 = F2 - E2  (effective deduction, end 2)
//   B  = C - F1 - F2  (clear face-to-face distance)
//
// Offset/direct-CTC:  Lcut = C − D1 − D2  =  C − F1 + E1 − F2 + E2
// Direct face-to-face: Lcut = B + E1 + E2
//
// Result is finished end-to-end length including inserted ends.
// NOT raw blank, facing loss, threading setup, or kerf.
//
// WARNING: Length does not establish that both ends can be assembled in
// place. Unions and assembly sequence are out of scope.
// ============================================================

import type {
  ThreadedInput,
  ThreadedFittingSpec,
  EngagementRecord,
  ThreadedResult,
  ThreadedError,
} from './schemas'

const ASSEMBLY_WARNING =
  'Length does not establish that both ends can be assembled in place; consider unions and assembly sequence.'

function tError(field: string, reason: string): ThreadedError {
  return { kind: 'threaded-error', field, reason }
}

// ---------------------------------------------------------------------------
// Validate a single fitting spec
// ---------------------------------------------------------------------------

function validateFitting(fitting: ThreadedFittingSpec, label: string): ThreadedError | null {
  if (fitting.threadFamily !== 'NPT') {
    return tError(
      `${label}.threadFamily`,
      `Thread family "${fitting.threadFamily}" is not supported. Only NPT male/female pairings are accepted. ` +
        'BSPT, BSPP, NPTF, NPSM, and unknown thread families are rejected — compatibility cannot be inferred from size or appearance.',
    )
  }
  if (!fitting.faceDistanceVerified) {
    return tError(
      `${label}.faceDistanceVerified`,
      `Face distance for ${label} (${fitting.nominalSizeNps}, ${fitting.angleDeg}°) is not verified. ` +
        `Source: ${fitting.faceDistanceSource}`,
    )
  }
  if (!isFinite(fitting.faceDistanceMm) || fitting.faceDistanceMm <= 0) {
    return tError(`${label}.faceDistanceMm`, 'Face distance must be a finite positive number')
  }
  return validateEngagement(fitting.engagement, `${label}.engagement`)
}

// ---------------------------------------------------------------------------
// Validate engagement record
// ---------------------------------------------------------------------------

function validateEngagement(eng: EngagementRecord, label: string): ThreadedError | null {
  if (!eng.confirmedByUser) {
    return tError(`${label}.confirmedByUser`, 'Engagement must be confirmed by user before calculation')
  }
  if (!eng.sourceDescription || eng.sourceDescription.trim() === '') {
    return tError(
      `${label}.sourceDescription`,
      'Engagement source description is required. Provide a named manufacturer reference or documented measured assembly.',
    )
  }
  if (!isFinite(eng.valueMm) || eng.valueMm <= 0) {
    return tError(`${label}.valueMm`, 'Engagement value must be a finite positive number')
  }
  if (!isFinite(eng.rangeMinMm) || eng.rangeMinMm <= 0) {
    return tError(`${label}.rangeMinMm`, 'Engagement range minimum must be a finite positive number')
  }
  if (!isFinite(eng.rangeMaxMm) || eng.rangeMaxMm <= 0) {
    return tError(`${label}.rangeMaxMm`, 'Engagement range maximum must be a finite positive number')
  }
  if (eng.rangeMinMm > eng.rangeMaxMm) {
    return tError(`${label}`, 'Engagement rangeMin must be ≤ rangeMax')
  }
  if (eng.valueMm < eng.rangeMinMm || eng.valueMm > eng.rangeMaxMm) {
    return tError(
      `${label}.valueMm`,
      `Engagement value ${eng.valueMm} mm is outside documented range [${eng.rangeMinMm}, ${eng.rangeMaxMm}] mm`,
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Compute from C (offset-derived or direct CTC)
// ---------------------------------------------------------------------------

function computeFromC(
  c: number,
  f1: ThreadedFittingSpec,
  f2: ThreadedFittingSpec,
): ThreadedResult | ThreadedError {
  const F1 = f1.faceDistanceMm
  const F2 = f2.faceDistanceMm
  const E1 = f1.engagement.valueMm
  const E2 = f2.engagement.valueMm
  const E1min = f1.engagement.rangeMinMm
  const E1max = f1.engagement.rangeMaxMm
  const E2min = f2.engagement.rangeMinMm
  const E2max = f2.engagement.rangeMaxMm

  const D1 = F1 - E1
  const D2 = F2 - E2

  if (D1 <= 0) {
    return tError('fitting1.effectiveDeduction', `Effective deduction D1 = F1 − E1 = ${F1} − ${E1} = ${D1} mm is not positive`)
  }
  if (D2 <= 0) {
    return tError('fitting2.effectiveDeduction', `Effective deduction D2 = F2 − E2 = ${F2} − ${E2} = ${D2} mm is not positive`)
  }

  const B = c - F1 - F2
  if (B < 0) {
    return tError('b', `Clear face-to-face distance B = C − F1 − F2 = ${c} − ${F1} − ${F2} = ${B} mm is negative — faces overlap`)
  }

  const cutLengthMm = c - F1 + E1 - F2 + E2
  const rangeMin = c - F1 + E1min - F2 + E2min
  const rangeMax = c - F1 + E1max - F2 + E2max

  // Target requires explicit per-end target confirmation; E values are project-entered
  // and represent the user's intended assembly depth. If both E values are in range, target is valid.
  const targetConfirmed = f1.engagement.confirmedByUser && f2.engagement.confirmedByUser

  return {
    kind: 'threaded-result',
    cutLengthMm: targetConfirmed ? cutLengthMm : null,
    targetNotConfirmed: !targetConfirmed,
    cutLengthRangeMm: [rangeMin, rangeMax],
    b: B,
    breakdown: {
      c,
      f1: F1,
      f2: F2,
      e1: E1,
      e2: E2,
      d1: D1,
      d2: D2,
      formula: 'C − F1 + E1 − F2 + E2',
    },
    label: 'finished-end-to-end-length-including-inserted-ends',
    warnings: [ASSEMBLY_WARNING],
  }
}

// ---------------------------------------------------------------------------
// Compute from B (face-to-face)
// ---------------------------------------------------------------------------

function computeFromB(
  b: number,
  f1: ThreadedFittingSpec,
  f2: ThreadedFittingSpec,
): ThreadedResult | ThreadedError {
  const F1 = f1.faceDistanceMm
  const F2 = f2.faceDistanceMm
  const E1 = f1.engagement.valueMm
  const E2 = f2.engagement.valueMm
  const E1min = f1.engagement.rangeMinMm
  const E1max = f1.engagement.rangeMaxMm
  const E2min = f2.engagement.rangeMinMm
  const E2max = f2.engagement.rangeMaxMm

  if (b < 0) {
    return tError('b', `Face-to-face distance B = ${b} mm is negative`)
  }

  const D1 = F1 - E1
  const D2 = F2 - E2

  if (D1 <= 0) {
    return tError('fitting1.effectiveDeduction', `Effective deduction D1 = ${D1} mm is not positive`)
  }
  if (D2 <= 0) {
    return tError('fitting2.effectiveDeduction', `Effective deduction D2 = ${D2} mm is not positive`)
  }

  const cutLengthMm = b + E1 + E2
  const rangeMin = b + E1min + E2min
  const rangeMax = b + E1max + E2max
  const c = b + F1 + F2

  const targetConfirmed = f1.engagement.confirmedByUser && f2.engagement.confirmedByUser

  return {
    kind: 'threaded-result',
    cutLengthMm: targetConfirmed ? cutLengthMm : null,
    targetNotConfirmed: !targetConfirmed,
    cutLengthRangeMm: [rangeMin, rangeMax],
    b,
    breakdown: {
      b,
      c,
      f1: F1,
      f2: F2,
      e1: E1,
      e2: E2,
      d1: D1,
      d2: D2,
      formula: 'B + E1 + E2',
    },
    label: 'finished-end-to-end-length-including-inserted-ends',
    warnings: [ASSEMBLY_WARNING],
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeThreadedCutLength(input: ThreadedInput): ThreadedResult | ThreadedError {
  const { fitting1, fitting2 } = input

  // Validate both fittings
  const e1 = validateFitting(fitting1, 'fitting1')
  if (e1) return e1
  const e2 = validateFitting(fitting2, 'fitting2')
  if (e2) return e2

  switch (input.inputMode) {
    case 'offset-derived-c':
      if (!isFinite(input.c) || input.c <= 0) {
        return tError('c', 'C must be a finite positive number (mm)')
      }
      return computeFromC(input.c, fitting1, fitting2)

    case 'direct-c':
      if (!isFinite(input.c) || input.c <= 0) {
        return tError('c', 'C must be a finite positive number (mm)')
      }
      return computeFromC(input.c, fitting1, fitting2)

    case 'direct-ftf':
      if (!isFinite(input.b) || input.b < 0) {
        return tError('b', 'B must be a finite non-negative number (mm)')
      }
      return computeFromB(input.b, fitting1, fitting2)
  }
}
