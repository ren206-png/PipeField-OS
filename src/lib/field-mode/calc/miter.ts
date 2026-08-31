// ============================================================
// Field Mode Calc — Miter / Segmented Bend Layout
// Pure TypeScript. No external deps.
// ============================================================

import {
  type Length,
  type CalcResult,
  fromMm,
  ok,
  err,
  makeInvalidInput,
} from './types'

export type MiterInput = {
  nps: string
  od_mm: number
  total_angle_deg: number
  segments: number
}

export type MiterResult = {
  cut_angle_deg: number
  throat_length: Length
  heel_length: Length
  layout_diameter: Length
  notes: string[]
}

export function miter(input: MiterInput): CalcResult<MiterResult> {
  if (input.segments < 2) {
    return err(makeInvalidInput('segments', 'minimum 2 segments'))
  }
  if (input.total_angle_deg <= 0 || input.total_angle_deg >= 180) {
    return err(makeInvalidInput('total_angle_deg', 'must be > 0 and < 180'))
  }
  if (input.od_mm <= 0) {
    return err(makeInvalidInput('od_mm', 'must be > 0'))
  }

  // For n segments, n-1 cuts, each cut at total_angle / (2 × (n-1)) from square
  const cutAngleDeg = input.total_angle_deg / (2 * (input.segments - 1))

  // Layout diameter = circumference for layout strip
  const layoutDiameterMm = Math.PI * input.od_mm

  const notes = [
    'Throat and heel lengths — owner to verify formula before use',
  ]

  // Approximate throat/heel lengths:
  // When cut at angle c from square on pipe OD d:
  // The cut produces an ellipse; short axis = d, long axis = d / cos(c)
  // throat (short side) ≈ 0 at the extreme; for a strip layout the difference
  // between heel and throat across the diameter = od × tan(c)
  // These are labelled for owner verification.
  const cutAngleRad = (cutAngleDeg * Math.PI) / 180
  const throatLengthMm = input.od_mm / 2 * (1 - Math.tan(cutAngleRad))
  const heelLengthMm = input.od_mm / 2 * (1 + Math.tan(cutAngleRad))

  return ok(
    {
      cut_angle_deg: cutAngleDeg,
      throat_length: fromMm(throatLengthMm),
      heel_length: fromMm(heelLengthMm),
      layout_diameter: fromMm(layoutDiameterMm),
      notes,
    },
    [],
  )
}
