// ============================================================
// Field Mode Calc — Flange Rotation (Two-Hole Method)
// Pure TypeScript. No framework/DB imports.
// ============================================================

import type { ReferenceAdapter } from './reference'
import {
  type Length,
  type CalcResult,
  type RefRow,
  fromMm,
  ok,
  err,
  makeMissingRef,
} from './types'

export type TwoHoleFlangeInput = {
  nps: string
  flange_class: number
  target_rotation_deg: number
  standard?: string
  edition?: string
}

export type TwoHoleFlangeResult = {
  hole_offset: Length
  bolt_circle_dia: Length
  bolt_count: number
  bolt_spacing_deg: number
  actual_rotation_achievable_deg: number
}

export async function twoHoleFlange(
  input: TwoHoleFlangeInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<TwoHoleFlangeResult>> {
  const rows = await ref.getFlange({
    nps: input.nps,
    flange_class: input.flange_class,
    standard: input.standard,
    edition: input.edition,
  })

  if (rows.length === 0) {
    return err(
      makeMissingRef('ref_flanges', {
        nps: input.nps,
        flange_class: input.flange_class,
        standard: input.standard,
        edition: input.edition,
      }),
    )
  }

  const allRefs: RefRow<unknown>[] = rows as RefRow<unknown>[]
  const row = rows[0].data

  const boltCount = row.bolt_count
  const boltCircleMm = row.bolt_circle_mm

  const boltSpacingDeg = 360 / boltCount
  // Nearest achievable rotation = round to nearest half bolt-spacing
  const halfSpacing = boltSpacingDeg / 2
  const actualRotation = Math.round(input.target_rotation_deg / halfSpacing) * halfSpacing

  // hole_offset = radius × sin(actualRotation)
  const radiusMm = boltCircleMm / 2
  const holeOffsetMm = radiusMm * Math.sin((actualRotation * Math.PI) / 180)

  return ok(
    {
      hole_offset: fromMm(holeOffsetMm),
      bolt_circle_dia: fromMm(boltCircleMm),
      bolt_count: boltCount,
      bolt_spacing_deg: boltSpacingDeg,
      actual_rotation_achievable_deg: actualRotation,
    },
    allRefs,
  )
}
