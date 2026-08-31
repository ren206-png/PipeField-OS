// ============================================================
// Field Mode Calc — Branch / Fishmouth Layout
// Pure TypeScript. No external deps.
// ============================================================

import {
  type Length,
  type CalcResult,
  fromMm,
  toMm,
  ok,
  err,
  makeInvalidInput,
} from './types'

export type BranchLayoutInput = {
  header_od: Length
  branch_od: Length
  branch_angle_deg: number
  /** Number of ordinates. Default 12 (every 30°). */
  ordinate_count?: number
}

export type BranchLayoutResult = {
  ordinates: Array<{ station_deg: number; ordinate: Length }>
  max_ordinate: Length
  notes: string[]
}

export function branchLayout(input: BranchLayoutInput): CalcResult<BranchLayoutResult> {
  const headerOdMm = toMm(input.header_od)
  const branchOdMm = toMm(input.branch_od)
  const angle = input.branch_angle_deg
  const count = input.ordinate_count ?? 12

  const notes: string[] = []

  if (branchOdMm > headerOdMm) {
    return err(makeInvalidInput('branch_od', 'branch OD must be <= header OD'))
  }
  if (angle <= 0 || angle >= 180) {
    return err(makeInvalidInput('branch_angle_deg', 'must be > 0 and < 180'))
  }
  if (count < 2) {
    return err(makeInvalidInput('ordinate_count', 'must be >= 2'))
  }

  const rHeader = headerOdMm / 2

  if (angle !== 90) {
    notes.push('Ordinate formula for angled laterals — owner to verify before use')
  }

  const sinAngle = Math.sin((angle * Math.PI) / 180)

  const ordinates: Array<{ station_deg: number; ordinate: Length }> = []
  let maxOrdMm = 0

  for (let i = 0; i <= count; i++) {
    const phi = (i / count) * 360
    const phiRad = (phi * Math.PI) / 180

    // Standard perpendicular (90°): ordinate(φ) = r_header × (1 − cos φ)
    // For angled lateral: scaled by 1/sin(angle)
    const ordMm = (rHeader / sinAngle) * (1 - Math.cos(phiRad))
    if (ordMm > maxOrdMm) maxOrdMm = ordMm

    ordinates.push({ station_deg: phi, ordinate: fromMm(ordMm) })
  }

  return ok({ ordinates, max_ordinate: fromMm(maxOrdMm), notes }, [])
}
