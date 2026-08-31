// ============================================================
// Field Mode Calc — Offset Calculators
// Pure TypeScript. No external deps.
// ============================================================

import {
  type Length,
  type Angle,
  type CalcResult,
  fromMm,
  fromDegrees,
  toMm,
  toDegrees,
  ok,
  err,
  makeInvalidInput,
} from './types'

// ---------------------------------------------------------------------------
// simpleOffset
// ---------------------------------------------------------------------------

export type SimpleOffsetInput =
  | { offset: Length; angle: Angle }
  | { offset: Length; run: Length }

export type SimpleOffsetResult = {
  travel: Length
  run: Length
  angle: Angle
}

function hasAngle(i: SimpleOffsetInput): i is { offset: Length; angle: Angle } {
  return 'angle' in i
}

export function simpleOffset(input: SimpleOffsetInput): CalcResult<SimpleOffsetResult> {
  const offsetMm = toMm(input.offset)
  if (offsetMm < 0) return err(makeInvalidInput('offset', 'must be >= 0'))

  if (hasAngle(input)) {
    const deg = toDegrees(input.angle)
    if (deg <= 0) return err(makeInvalidInput('angle', 'must be > 0°'))
    if (deg >= 90) return err(makeInvalidInput('angle', 'must be < 90°'))

    const rad = (deg * Math.PI) / 180
    const runMm = offsetMm / Math.tan(rad)
    const travelMm = offsetMm / Math.sin(rad)

    return ok(
      { travel: fromMm(travelMm), run: fromMm(runMm), angle: input.angle },
      [],
    )
  } else {
    const runMm = toMm(input.run)
    if (runMm < 0) return err(makeInvalidInput('run', 'must be >= 0'))
    if (runMm === 0 && offsetMm === 0) {
      return err(makeInvalidInput('run', 'run and offset cannot both be zero'))
    }
    if (runMm === 0) return err(makeInvalidInput('run', 'must be > 0 (would imply 90° angle)'))

    const rad = Math.atan(offsetMm / runMm)
    const deg = (rad * 180) / Math.PI
    const travelMm = Math.sqrt(offsetMm * offsetMm + runMm * runMm)

    return ok(
      { travel: fromMm(travelMm), run: input.run, angle: fromDegrees(deg) },
      [],
    )
  }
}

// ---------------------------------------------------------------------------
// rollingOffset
// ---------------------------------------------------------------------------

export type RollingOffsetInput = { rise: Length; roll: Length; angle: Angle }
export type RollingOffsetResult = {
  true_offset: Length
  travel: Length
  run: Length
  rotation: Angle
}

export function rollingOffset(input: RollingOffsetInput): CalcResult<RollingOffsetResult> {
  const riseMm = toMm(input.rise)
  const rollMm = toMm(input.roll)
  const deg = toDegrees(input.angle)

  if (riseMm < 0) return err(makeInvalidInput('rise', 'must be >= 0'))
  if (rollMm < 0) return err(makeInvalidInput('roll', 'must be >= 0'))
  if (deg <= 0) return err(makeInvalidInput('angle', 'must be > 0°'))
  if (deg >= 90) return err(makeInvalidInput('angle', 'must be < 90°'))

  const trueOffsetMm = Math.sqrt(riseMm * riseMm + rollMm * rollMm)
  const rad = (deg * Math.PI) / 180
  const travelMm = trueOffsetMm / Math.sin(rad)
  const runMm = trueOffsetMm / Math.tan(rad)
  const rotationRad = Math.atan2(rollMm, riseMm)
  const rotationDeg = (rotationRad * 180) / Math.PI

  return ok(
    {
      true_offset: fromMm(trueOffsetMm),
      travel: fromMm(travelMm),
      run: fromMm(runMm),
      rotation: fromDegrees(rotationDeg),
    },
    [],
  )
}

// ---------------------------------------------------------------------------
// parallelOffsets
// ---------------------------------------------------------------------------

export type OffsetLine = {
  od_mm: number
  insulation_mm: number
  offset: Length
  angle: Angle
}

export type ParallelOffsetInput = {
  lines: OffsetLine[]
  spacing_requirement_mm?: number
}

export type ParallelOffsetResult = {
  lines: Array<{ travel: Length; run: Length; travel_adjustment: Length }>
  clearance_violations: Array<{
    between_lines: [number, number]
    clearance_mm: number
    required_mm: number
  }>
}

export function parallelOffsets(input: ParallelOffsetInput): CalcResult<ParallelOffsetResult> {
  if (input.lines.length < 2 || input.lines.length > 4) {
    return err(makeInvalidInput('lines', 'must have 2–4 lines'))
  }

  const requiredMm = input.spacing_requirement_mm ?? 0
  const results: Array<{ travel: Length; run: Length; travel_adjustment: Length }> = []
  const violations: Array<{
    between_lines: [number, number]
    clearance_mm: number
    required_mm: number
  }> = []

  for (const line of input.lines) {
    const r = simpleOffset({ offset: line.offset, angle: line.angle })
    if (!r.ok) return r
    results.push({
      travel: r.value.travel,
      run: r.value.run,
      travel_adjustment: fromMm(0),
    })
  }

  // Check clearances between adjacent lines
  // Face-to-face clearance = spacing_requirement_mm compared against
  // (od_a/2 + insulation_a) + (od_b/2 + insulation_b)
  for (let i = 0; i < input.lines.length - 1; i++) {
    const a = input.lines[i]
    const b = input.lines[i + 1]
    const minClearanceMm = a.od_mm / 2 + a.insulation_mm + b.od_mm / 2 + b.insulation_mm
    if (requiredMm > 0 && minClearanceMm < requiredMm) {
      violations.push({
        between_lines: [i, i + 1],
        clearance_mm: minClearanceMm,
        required_mm: requiredMm,
      })
    }
  }

  return ok({ lines: results, clearance_violations: violations }, [])
}
