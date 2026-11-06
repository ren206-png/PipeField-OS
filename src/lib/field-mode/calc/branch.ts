// ============================================================
// Field Mode Calc — Branch / Fishmouth Layout
// Pure TypeScript. No external deps.
//
// Geometry: header radius R, branch radius r, branch axis at angle θ to the
// header axis, axes intersecting. Going round the branch at station φ
// (φ = 0 on the side facing along the header axis), the branch surface meets
// the header at a distance along the branch axis of
//
//     t(φ) = ( √(R² − r²·sin²φ) − r·cosφ·cosθ ) / sinθ
//
// The template ordinate at each station is the cut-back from the longest
// element:  ordinate(φ) = t_max − t(φ)  (0 where the branch is longest).
// For a 90° branch this is the familiar  R − √(R² − r²·sin²φ).
//
// Stations are equal divisions round the branch; `arc` is the distance to
// mark each station along the branch's outside circumference from station 0.
// Uses outside diameters (set-on branch, cut on the branch OD).
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
  /** Number of equal stations round the branch. Default 16. */
  ordinate_count?: number
}

export type BranchLayoutResult = {
  ordinates: Array<{ station_deg: number; ordinate: Length; arc: Length }>
  max_ordinate: Length
  notes: string[]
}

/** Distance along the branch axis to the header surface at station φ (radians). */
function contactDistance(R: number, r: number, phi: number, theta: number): number {
  const s = Math.sin(phi)
  return (Math.sqrt(R * R - r * r * s * s) - r * Math.cos(phi) * Math.cos(theta)) / Math.sin(theta)
}

export function branchLayout(input: BranchLayoutInput): CalcResult<BranchLayoutResult> {
  const headerOdMm = toMm(input.header_od)
  const branchOdMm = toMm(input.branch_od)
  const angle = input.branch_angle_deg
  const count = input.ordinate_count ?? 16

  if (!(headerOdMm > 0)) return err(makeInvalidInput('header_od', 'must be > 0'))
  if (!(branchOdMm > 0)) return err(makeInvalidInput('branch_od', 'must be > 0'))
  if (branchOdMm > headerOdMm) {
    return err(makeInvalidInput('branch_od', 'branch OD must be <= header OD'))
  }
  if (!(angle > 0 && angle < 180)) {
    return err(makeInvalidInput('branch_angle_deg', 'must be > 0 and < 180'))
  }
  if (!Number.isInteger(count) || count < 4) {
    return err(makeInvalidInput('ordinate_count', 'must be a whole number >= 4'))
  }

  const R = headerOdMm / 2
  const r = branchOdMm / 2
  const theta = (angle * Math.PI) / 180
  const notes: string[] = [
    'Ordinates use outside diameters (set-on branch). Check the first fit-up.',
  ]
  if (angle < 30 || angle > 150) {
    notes.push('Very shallow lateral: the cut is long and sharp — consider a fabricated fitting.')
  }

  // Longest element over the full circle (fine sampling, independent of stations)
  let tMax = -Infinity
  for (let k = 0; k <= 3600; k++) {
    tMax = Math.max(tMax, contactDistance(R, r, (k / 3600) * 2 * Math.PI, theta))
  }

  const circumference = Math.PI * branchOdMm
  const ordinates: Array<{ station_deg: number; ordinate: Length; arc: Length }> = []
  let maxOrdMm = 0
  for (let i = 0; i <= count; i++) {
    const phiDeg = (i / count) * 360
    const ordMm = Math.max(0, tMax - contactDistance(R, r, (phiDeg * Math.PI) / 180, theta))
    if (ordMm > maxOrdMm) maxOrdMm = ordMm
    ordinates.push({
      station_deg: phiDeg,
      ordinate: fromMm(ordMm),
      arc: fromMm((circumference * i) / count),
    })
  }

  return ok({ ordinates, max_ordinate: fromMm(maxOrdMm), notes }, [])
}
