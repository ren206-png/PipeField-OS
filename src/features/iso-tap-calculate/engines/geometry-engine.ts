// ============================================================
// ISO Tap-to-Calculate — Geometry Engine (1B)
// Pure TypeScript. Zero framework/DB/browser imports.
// ============================================================
// Mode A: known V (rise), H (roll), U (run) → T, θ
// Mode B: known V (rise), H (roll), θ → T, U
//
// Reuses rollingOffset from offsets.ts for Mode B.
// Mode B rotation is NOT exposed — convention not documented.
// ============================================================

import { rollingOffset } from '../../../lib/field-mode/calc/offsets'
import { fromMm, fromDegrees, toMm, toDegrees, type CalcError } from '../../../lib/field-mode/calc/types'

function calcErrorMessage(e: CalcError): string {
  switch (e.kind) {
    case 'ParseError': return e.reason
    case 'InvalidInput': return e.reason
    case 'MissingReferenceData': return `Missing reference data: ${e.table}`
    case 'UnverifiedReferenceData': return `Unverified reference data: ${e.table} row ${e.row_id}`
    case 'ExceedsSWL': return `Exceeds SWL: applied=${e.applied_load_kg}kg swl=${e.swl_kg}kg`
  }
}

function calcErrorField(e: CalcError): string {
  switch (e.kind) {
    case 'ParseError': return 'input'
    case 'InvalidInput': return e.field
    case 'MissingReferenceData': return e.table
    case 'UnverifiedReferenceData': return e.table
    case 'ExceedsSWL': return 'load'
  }
}
import type {
  ModeAInput,
  ModeAResult,
  ModeBInput,
  ModeBResult,
  GeometryError,
} from './schemas'

function geoError(field: string, reason: string): GeometryError {
  return { kind: 'geometry-error', field, reason }
}

// ---------------------------------------------------------------------------
// Mode A — known V, H, U
// O = hypot(V, H)
// T = hypot(V, H, U)
// θ = atan2(O, U)
// ---------------------------------------------------------------------------

export function computeModeA(input: ModeAInput): ModeAResult | GeometryError {
  if (!input.rise.confirmed) return geoError('rise', 'Measurement must be confirmed before calculation')
  if (!input.roll.confirmed) return geoError('roll', 'Measurement must be confirmed before calculation')
  if (!input.run.confirmed) return geoError('run', 'Measurement must be confirmed before calculation')

  const V = input.rise.valueMm
  const H = input.roll.valueMm
  const U = input.run.valueMm

  if (!isFinite(V)) return geoError('rise', 'Non-finite value')
  if (!isFinite(H)) return geoError('roll', 'Non-finite value')
  if (!isFinite(U)) return geoError('run', 'Non-finite value')
  if (U <= 0) return geoError('run', 'Run must be > 0 for a valid offset (U ≤ 0 is not a two-elbow offset)')

  const O = Math.hypot(V, H)
  const T = Math.hypot(V, H, U)
  const thetaDeg = Math.atan2(O, U) * (180 / Math.PI)

  if (!isFinite(T) || T <= 0) return geoError('travel', 'Computed travel is non-finite or zero')
  if (!isFinite(thetaDeg)) return geoError('theta', 'Computed angle is non-finite')

  return {
    kind: 'mode-a',
    trueOffset: O,
    travel: T,
    thetaDeg,
  }
}

// ---------------------------------------------------------------------------
// Mode B — known V, H, θ
// Delegates to rollingOffset (offsets.ts:55) which computes:
//   trueOffset = hypot(rise, roll)
//   travel = trueOffset / sin(θ)
//   run = trueOffset / tan(θ)
// Rotation angle is deliberately NOT exposed — convention undocumented.
// ---------------------------------------------------------------------------

export function computeModeB(input: ModeBInput): ModeBResult | GeometryError {
  if (!input.rise.confirmed) return geoError('rise', 'Measurement must be confirmed before calculation')
  if (!input.roll.confirmed) return geoError('roll', 'Measurement must be confirmed before calculation')

  const angleDeg = input.angleDeg
  if (angleDeg <= 0 || angleDeg >= 90) {
    return geoError('angleDeg', 'Angle must be > 0° and < 90°')
  }

  const V = input.rise.valueMm
  const H = input.roll.valueMm

  if (!isFinite(V)) return geoError('rise', 'Non-finite value')
  if (!isFinite(H)) return geoError('roll', 'Non-finite value')

  const O = Math.hypot(V, H)
  if (O === 0) {
    return geoError('offset', 'True offset is zero — a zero-offset case is not a two-elbow offset')
  }

  // rollingOffset requires non-negative rise and roll (it rejects negatives)
  // We use absolute values for geometry; the sign is a direction convention not
  // relevant to the magnitude calculation.
  const result = rollingOffset({
    rise: fromMm(Math.abs(V)),
    roll: fromMm(Math.abs(H)),
    angle: fromDegrees(angleDeg),
  })

  if (!result.ok) {
    return geoError(calcErrorField(result.error), calcErrorMessage(result.error))
  }

  const travel = toMm(result.value.travel)
  const run = toMm(result.value.run)
  // trueOffset from rollingOffset uses Math.sqrt(rise² + roll²) which equals Math.hypot(V, H)
  const trueOffset = toMm(result.value.true_offset)

  return {
    kind: 'mode-b',
    trueOffset,
    travel,
    run,
    travelLabel: 'centreline-intersection-to-centreline-intersection',
  }
}

// ---------------------------------------------------------------------------
// Angle comparison helper
// Numerical tolerance for floating-point comparison — NOT fabrication tolerance.
// If !match, cut length must be blocked.
// ---------------------------------------------------------------------------

export function checkFittingAngle(
  thetaRequired: number,
  fittingAngleDeg: number,
  toleranceDeg: number,
): { match: boolean; delta: number } {
  const delta = Math.abs(thetaRequired - fittingAngleDeg)
  return { match: delta <= toleranceDeg, delta }
}
