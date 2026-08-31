// ============================================================
// Field Mode Calc — Odd-Angle Elbow Cut
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
  makeInvalidInput,
  makeMissingRef,
} from './types'

export type OddAngleCutInput = {
  nps: string
  radius_type: 'LR' | 'SR'
  target_angle_deg: number
  standard?: string
  edition?: string
}

export type OddAngleCutResult = {
  cut_back: Length
  arc_length: Length
  notes: string[]
}

const SMALL_NPS = new Set(['1/2', '3/4'])

export async function oddAngleCut(
  input: OddAngleCutInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<OddAngleCutResult>> {
  if (input.target_angle_deg <= 0 || input.target_angle_deg >= 90) {
    return err(makeInvalidInput('target_angle_deg', 'must be > 0 and < 90'))
  }

  const fittingType = input.radius_type === 'LR' ? 'elbow_90_lr' : 'elbow_90_sr'
  const rows = await ref.getBwFitting({
    nps: input.nps,
    fitting_type: fittingType,
    standard: input.standard,
    edition: input.edition,
  })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_bw_fittings', {
      nps: input.nps,
      fitting_type: fittingType,
      standard: input.standard,
      edition: input.edition,
    }))
  }

  const allRefs: RefRow<unknown>[] = rows as RefRow<unknown>[]
  const A = rows[0].data.center_to_end_mm
  // For LR elbow, centerline radius R = A (standard definition: A = R for LR)
  const R = A

  const theta = input.target_angle_deg
  // Amount cut from the butt end to achieve theta degrees instead of 90
  const cutBackMm = R * (1 - Math.cos(((90 - theta) * Math.PI) / 180))
  // Arc length along centerline
  const arcLengthMm = R * ((90 - theta) * Math.PI) / 180

  const notes: string[] = []
  if (SMALL_NPS.has(input.nps)) {
    notes.push(
      'NPS ½ and ¾ elbows may have non-standard radius — verify against fitting before cutting',
    )
  }

  return ok(
    {
      cut_back: fromMm(cutBackMm),
      arc_length: fromMm(arcLengthMm),
      notes,
    },
    allRefs,
  )
}
