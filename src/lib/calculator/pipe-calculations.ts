// ============================================================
// PipeField OS — Pipe Calculation Engine
//
// All the math behind the take-off calculator.
// Pure functions — no UI, no state, easy to test.
//
// GLOSSARY (for anyone new to pipe fitting):
//
//   NPS         — Nominal Pipe Size (the name, e.g. "4 inch")
//   OD          — Outside Diameter (actual measured size)
//   ID          — Inside Diameter (OD minus two wall thicknesses)
//   CTF         — Center-To-Face (fitting dimension from center to end)
//   Take-Out    — How much a fitting "takes out" of your run length
//   Weld Gap    — Space between pipe ends at the weld joint
//   Offset      — A parallel shift from one pipe run to another
//   Travel      — Actual pipe length along the diagonal of the offset
//   Set         — The horizontal distance of the offset
//   Run         — Horizontal distance along the original pipe axis
//   Roll        — Offset in the plane perpendicular to Set
//   True Offset — Combined diagonal when Set and Roll both exist
// ============================================================

import {
  getPipeOD,
  getWallThickness,
  getPipeID,
  getCenterToFace,
  type NpsSize,
  type PipeSchedule,
  type FittingType,
} from '@/config/pipe-data'

// ============================================================
// UTILITY: Fraction string → decimal inches
// Handles inputs like "3/8", "1-1/2", "12", "12.375"
// ============================================================
export function parseFraction(input: string): number | null {
  if (!input || input.trim() === '') return null
  const str = input.trim()

  // Pure decimal — "12.375"
  if (/^\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str)
  }

  // Simple fraction — "3/8"
  if (/^\d+\/\d+$/.test(str)) {
    const [num, den] = str.split('/').map(Number)
    if (den === 0) return null
    return num / den
  }

  // Mixed number — "1-1/2" or "1 1/2"
  const mixed = str.match(/^(\d+)[- ](\d+)\/(\d+)$/)
  if (mixed) {
    const whole = parseInt(mixed[1])
    const num   = parseInt(mixed[2])
    const den   = parseInt(mixed[3])
    if (den === 0) return null
    return whole + num / den
  }

  return null
}

// ============================================================
// UTILITY: Decimal inches → feet-inches-fraction string
// e.g. 14.375 → "1'-2-3/8""
// ============================================================
export function toFeetInches(inches: number): string {
  const feet  = Math.floor(inches / 12)
  const rem   = inches - feet * 12
  const whole = Math.floor(rem)
  const frac  = rem - whole

  const fractions: { num: number; den: number; val: number }[] = [
    { num: 0, den: 1, val: 0 },
    { num: 1, den: 16, val: 1/16 },
    { num: 1, den: 8,  val: 1/8 },
    { num: 3, den: 16, val: 3/16 },
    { num: 1, den: 4,  val: 1/4 },
    { num: 5, den: 16, val: 5/16 },
    { num: 3, den: 8,  val: 3/8 },
    { num: 7, den: 16, val: 7/16 },
    { num: 1, den: 2,  val: 1/2 },
    { num: 9, den: 16, val: 9/16 },
    { num: 5, den: 8,  val: 5/8 },
    { num: 11, den: 16, val: 11/16 },
    { num: 3, den: 4,  val: 3/4 },
    { num: 13, den: 16, val: 13/16 },
    { num: 7, den: 8,  val: 7/8 },
    { num: 15, den: 16, val: 15/16 },
  ]

  const closest = fractions.reduce((prev, curr) =>
    Math.abs(curr.val - frac) < Math.abs(prev.val - frac) ? curr : prev
  )

  let inchPart = ''
  if (closest.num === 0) {
    inchPart = whole === 0 ? '' : `${whole}"`
  } else {
    inchPart = whole > 0
      ? `${whole}-${closest.num}/${closest.den}"`
      : `${closest.num}/${closest.den}"`
  }

  if (feet === 0) return inchPart || '0"'
  return inchPart ? `${feet}'-${inchPart}` : `${feet}'-0"`
}

// ============================================================
// PIPE PROPERTIES CALCULATION
// ============================================================
export interface PipeProperties {
  nps: NpsSize
  schedule: PipeSchedule
  od: number           // inches
  wallThickness: number // inches
  id: number           // inches
  // Custom override fields
  customOD?: number
  customWall?: number
}

export interface PipePropertiesResult {
  od: number
  wall: number
  id: number
  isCustom: boolean
  warnings: string[]
}

export function calculatePipeProperties(
  nps: NpsSize,
  schedule: PipeSchedule,
  customOD?: number,
  customWall?: number
): PipePropertiesResult {
  const warnings: string[] = []

  if (schedule === 'custom') {
    if (!customOD || !customWall) {
      return {
        od: customOD ?? 0,
        wall: customWall ?? 0,
        id: customOD && customWall ? customOD - 2 * customWall : 0,
        isCustom: true,
        warnings: ['Enter custom OD and wall thickness to calculate ID.'],
      }
    }
    return {
      od: customOD,
      wall: customWall,
      id: customOD - 2 * customWall,
      isCustom: true,
      warnings,
    }
  }

  const od   = getPipeOD(nps)
  const wall = getWallThickness(nps, schedule)
  const id   = getPipeID(nps, schedule)

  if (od === null) {
    warnings.push(`OD not found for NPS ${nps}. Values are [SAMPLE] — verify against ASME B36.10M.`)
  }
  if (wall === null) {
    warnings.push(`Schedule ${schedule} is not standard for NPS ${nps}. Use custom wall thickness.`)
  }

  warnings.push('Pipe dimensions are [SAMPLE VALUES]. Verify against ASME B36.10M / B36.19M before use.')

  return {
    od:   od   ?? 0,
    wall: wall ?? 0,
    id:   id   ?? 0,
    isCustom: false,
    warnings,
  }
}

// ============================================================
// TAKE-OUT CALCULATION
//
// Take-Out (TO) = Center-to-Face (CTF) of the fitting
//
// For a single 90° LR elbow at the end of a pipe run:
//   Pipe Cut Length = Total Run - Take-Out + Weld Gap
//
// For a pipe between TWO fittings:
//   Pipe Cut Length = Face-to-Face - (all take-outs) + (weld gaps × number of joints)
// ============================================================
export interface TakeOutInput {
  nps: NpsSize
  fittingType: FittingType
  weldGapInches: number
  customCTF?: number           // For custom fittings
  numberOfFittings?: number    // How many of this fitting on this pipe
}

export interface TakeOutResult {
  centerToFace: number         // inches
  takeOut: number              // inches
  takeOutPerFitting: number    // inches
  weldGapContribution: number  // inches per joint
  warnings: string[]
}

export function calculateTakeOut(input: TakeOutInput): TakeOutResult {
  const warnings: string[] = []
  const { nps, fittingType, weldGapInches, customCTF, numberOfFittings = 1 } = input

  let ctf = getCenterToFace(fittingType, nps)

  if (fittingType === 'custom') {
    if (customCTF == null) {
      warnings.push('Enter the center-to-face dimension for your custom fitting.')
      ctf = 0
    } else {
      ctf = customCTF
    }
  }

  if (ctf === null) {
    warnings.push(`Center-to-face for ${fittingType} at NPS ${nps} requires manufacturer data. Enter manually.`)
    ctf = 0
  } else {
    warnings.push('Fitting dimensions are [SAMPLE VALUES based on ASME B16.9]. Verify before fabrication.')
  }

  const takeOutPerFitting = ctf
  const totalTakeOut      = takeOutPerFitting * numberOfFittings

  return {
    centerToFace:           ctf,
    takeOut:                totalTakeOut,
    takeOutPerFitting,
    weldGapContribution:    weldGapInches,
    warnings,
  }
}

// ============================================================
// PIPE CUT LENGTH CALCULATION
//
// This is the length you cut the pipe to.
//
// Formula (pipe between two fittings):
//   Cut Length = Face-to-Face Distance
//              - TakeOut_FittingA
//              - TakeOut_FittingB
//              + WeldGap_A
//              + WeldGap_B
//
// Formula (pipe with one fitting on one end):
//   Cut Length = Total Run - TakeOut + WeldGap
// ============================================================
export interface CutLengthInput {
  totalRunInches: number        // Overall face-to-face or run dimension
  takeOutA: number              // Take-out for fitting at end A
  takeOutB: number              // Take-out for fitting at end B (0 if plain end)
  weldGapA: number              // Weld gap at end A
  weldGapB: number              // Weld gap at end B (0 if plain end)
}

export interface CutLengthResult {
  cutLengthInches: number
  cutLengthDisplay: string      // Formatted feet-inches
  faceToFaceInches: number
  totalTakeOut: number
  totalWeldGap: number
}

export function calculateCutLength(input: CutLengthInput): CutLengthResult {
  const { totalRunInches, takeOutA, takeOutB, weldGapA, weldGapB } = input

  const totalTakeOut = takeOutA + takeOutB
  const totalWeldGap = weldGapA + weldGapB
  const cutLength    = totalRunInches - totalTakeOut + totalWeldGap

  return {
    cutLengthInches:  cutLength,
    cutLengthDisplay: toFeetInches(Math.max(0, cutLength)),
    faceToFaceInches: totalRunInches,
    totalTakeOut,
    totalWeldGap,
  }
}

// ============================================================
// SIMPLE OFFSET CALCULATOR
//
// A "simple offset" or "parallel offset" uses two elbows of
// the same angle to shift a pipe run from one elevation/position
// to a parallel position at a different elevation/position.
//
// Given: Offset (the perpendicular distance to shift)
//        Angle  (45°, 22.5°, 30°, 60°)
//
// Outputs:
//   Travel  = Offset / sin(angle)
//             (the actual diagonal pipe length between the two fittings)
//
//   Run     = Offset / tan(angle)
//   (also called "Horizontal Run" — the parallel distance consumed)
//
// Both Travel and Run are "pipe spool lengths" (center-to-center
// of the two fittings, BEFORE subtracting take-outs).
// ============================================================
export interface SimpleOffsetInput {
  offsetInches: number     // The perpendicular distance you need to shift
  angleDegrees: number     // The elbow angle (e.g. 45)
}

export interface SimpleOffsetResult {
  travel: number           // Diagonal pipe spool length (center to center), inches
  run: number              // Horizontal distance consumed, inches
  travelDisplay: string
  runDisplay: string
  angleDegrees: number
  offsetDisplay: string
}

export function calculateSimpleOffset(input: SimpleOffsetInput): SimpleOffsetResult {
  const { offsetInches, angleDegrees } = input
  const angleRad = (angleDegrees * Math.PI) / 180

  const travel = offsetInches / Math.sin(angleRad)
  const run    = offsetInches / Math.tan(angleRad)

  return {
    travel,
    run,
    travelDisplay: toFeetInches(travel),
    runDisplay:    toFeetInches(run),
    angleDegrees,
    offsetDisplay: toFeetInches(offsetInches),
  }
}

// ============================================================
// ROLLING OFFSET CALCULATOR
//
// A "rolling offset" occurs when the pipe shifts in TWO planes
// simultaneously — it moves sideways (Set) AND it moves up or
// down (Roll) at the same time.
//
// Given: Set  (side-to-side shift)
//        Roll (up-down shift)
//        Angle (elbow angle)
//
// Outputs:
//   True Offset = √(Set² + Roll²)
//                 (the actual diagonal distance through space)
//
//   Travel = True Offset / sin(angle)
//            (the pipe spool length between the two fittings)
//
//   Run    = True Offset / tan(angle)
//
//   Diagonal = √(Set² + Roll²)   ← same as True Offset
// ============================================================
export interface RollingOffsetInput {
  setInches:    number    // The side-to-side (horizontal) shift
  rollInches:   number    // The up-down (vertical) shift
  angleDegrees: number    // The elbow angle
}

export interface RollingOffsetResult {
  trueOffset: number       // The combined diagonal shift, inches
  travel:     number       // Pipe spool length (CTF to CTF), inches
  run:        number       // Consumed run distance, inches
  trueOffsetDisplay: string
  travelDisplay:     string
  runDisplay:        string
  setDisplay:        string
  rollDisplay:       string
}

export function calculateRollingOffset(input: RollingOffsetInput): RollingOffsetResult {
  const { setInches, rollInches, angleDegrees } = input
  const angleRad = (angleDegrees * Math.PI) / 180

  const trueOffset = Math.sqrt(setInches ** 2 + rollInches ** 2)
  const travel     = trueOffset / Math.sin(angleRad)
  const run        = trueOffset / Math.tan(angleRad)

  return {
    trueOffset,
    travel,
    run,
    trueOffsetDisplay: toFeetInches(trueOffset),
    travelDisplay:     toFeetInches(travel),
    runDisplay:        toFeetInches(run),
    setDisplay:        toFeetInches(setInches),
    rollDisplay:       toFeetInches(rollInches),
  }
}

// ============================================================
// TRAVEL + SET + ROLL FROM TRUE OFFSET (Reverse calculation)
// Given travel and one offset, find the others.
// ============================================================
export interface TravelFromOffsetInput {
  trueOffsetInches: number
  angleDegrees:     number
}

export interface TravelFromOffsetResult {
  travel: number
  run:    number
  travelDisplay: string
  runDisplay:    string
}

export function calculateTravelFromTrueOffset(
  input: TravelFromOffsetInput
): TravelFromOffsetResult {
  const { trueOffsetInches, angleDegrees } = input
  const angleRad = (angleDegrees * Math.PI) / 180
  const travel = trueOffsetInches / Math.sin(angleRad)
  const run    = trueOffsetInches / Math.tan(angleRad)
  return {
    travel,
    run,
    travelDisplay: toFeetInches(travel),
    runDisplay:    toFeetInches(run),
  }
}

// ============================================================
// ROUND to nearest 1/16"
// Useful for snapping calculated values to measurable fractions
// ============================================================
export function roundToSixteenth(inches: number): number {
  return Math.round(inches * 16) / 16
}

// ============================================================
// FORMAT decimal inches to a simple display string
// e.g. 14.375 → "14-3/8"" or just "14.375""
// ============================================================
export function formatInches(inches: number, precision: number = 4): string {
  return `${inches.toFixed(precision)}"`
}
