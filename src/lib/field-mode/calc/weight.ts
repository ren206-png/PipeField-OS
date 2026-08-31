// ============================================================
// Field Mode Calc — Weight Calculators
// Pure TypeScript. No framework/DB imports.
// ============================================================

import type { ReferenceAdapter } from './reference'
import {
  type Length,
  type CalcResult,
  type RefRow,
  toMm,
  toMetres,
  ok,
  err,
  makeInvalidInput,
  makeMissingRef,
} from './types'

// ---------------------------------------------------------------------------
// Pipe Weight
// ---------------------------------------------------------------------------

export type PipeWeightInput = {
  od_mm: number
  wall_mm: number
  length: Length
  /** kg/m³. Default 7850 (carbon steel) */
  density_kg_per_m3?: number
}

export type PipeWeightResult = {
  weight_kg: number
  weight_per_metre_kg: number
}

export function pipeWeight(input: PipeWeightInput): CalcResult<PipeWeightResult> {
  const { od_mm, wall_mm } = input
  const density = input.density_kg_per_m3 ?? 7850

  if (od_mm <= 0) return err(makeInvalidInput('od_mm', 'must be > 0'))
  if (wall_mm <= 0) return err(makeInvalidInput('wall_mm', 'must be > 0'))
  if (wall_mm >= od_mm / 2) return err(makeInvalidInput('wall_mm', 'must be < OD/2'))

  const id_mm = od_mm - 2 * wall_mm
  const od_m = od_mm / 1000
  const id_m = id_mm / 1000

  const crossAreaM2 = (Math.PI / 4) * (od_m * od_m - id_m * id_m)
  const weightPerMetreKg = crossAreaM2 * density

  const lengthM = toMetres(input.length)
  const weightKg = weightPerMetreKg * lengthM

  return ok({ weight_kg: weightKg, weight_per_metre_kg: weightPerMetreKg }, [])
}

// ---------------------------------------------------------------------------
// Plate Steel Weight
// ---------------------------------------------------------------------------

export type PlateWeightInput = {
  thickness_in: number
  width_in: number
  length_in: number
}

export type PlateWeightResult = {
  weight_kg: number
  weight_per_sqft_lb: number
}

export async function plateWeight(
  input: PlateWeightInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<PlateWeightResult>> {
  const rows = await ref.getPlateSteelWeight({ thickness_in: input.thickness_in })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_plate_steel_weights', { thickness_in: input.thickness_in }))
  }

  const allRefs: RefRow<unknown>[] = rows as RefRow<unknown>[]
  const row = rows[0].data
  const weightPsf = row.weight_lb_per_ft2
  if (weightPsf == null) {
    return err(makeMissingRef('ref_plate_steel_weights', { thickness_in: input.thickness_in, dim: 'weight_lb_per_ft2' }))
  }

  const areaFt2 = (input.width_in / 12) * (input.length_in / 12)
  const weightLb = weightPsf * areaFt2
  const weightKg = weightLb * 0.453592

  return ok({ weight_kg: weightKg, weight_per_sqft_lb: weightPsf }, allRefs)
}

// ---------------------------------------------------------------------------
// Material Weight
// ---------------------------------------------------------------------------

export type MaterialWeightInput = {
  material: string
  volume_m3: number
}

export type MaterialWeightResult = {
  weight_kg: number
  density_kg_per_m3: number
}

export async function materialWeight(
  input: MaterialWeightInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<MaterialWeightResult>> {
  const rows = await ref.getMaterialWeight({ material: input.material })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_material_weights', { material: input.material }))
  }

  const allRefs: RefRow<unknown>[] = rows as RefRow<unknown>[]
  const row = rows[0].data
  const density = row.density_kg_per_m3
  if (density == null) {
    return err(makeMissingRef('ref_material_weights', { material: input.material, dim: 'density_kg_per_m3' }))
  }

  const weightKg = density * input.volume_m3

  return ok({ weight_kg: weightKg, density_kg_per_m3: density }, allRefs)
}
