// ============================================================
// Field Mode Calc — Rigging Calculators
// CRITICAL: All rigging functions refuse to compute if ANY consumed
// RefRow has verified === false. Return UnverifiedReferenceData before
// returning any load value.
// ============================================================

import type { ReferenceAdapter } from './reference'
import {
  type CalcResult,
  type CalcError,
  type RefRow,
  ok,
  err,
  makeMissingRef,
} from './types'

// ---------------------------------------------------------------------------
// Verification guard
// ---------------------------------------------------------------------------

function checkVerified(rows: RefRow<unknown>[], tableName: string): CalcError | null {
  for (const row of rows) {
    if (!row.verified) {
      return {
        kind: 'UnverifiedReferenceData',
        table: tableName,
        row_id: row.row_id,
        recall_confidence: row.recall_confidence,
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// slingLegTension
// ---------------------------------------------------------------------------

export async function slingLegTension(
  input: {
    load_kg: number
    angle_from_horizontal_deg: number
    num_legs: number
    standard?: string
  },
  ref: ReferenceAdapter,
): Promise<CalcResult<{ leg_tension_kg: number; factor: number }>> {
  const rows = await ref.getSlingLegFactor({
    angle_from_horizontal_deg: input.angle_from_horizontal_deg,
    standard: input.standard,
  })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_sling_leg_factors', {
      angle_from_horizontal_deg: input.angle_from_horizontal_deg,
    }))
  }

  const verifyErr = checkVerified(rows as RefRow<unknown>[], 'ref_sling_leg_factors')
  if (verifyErr) return err(verifyErr)

  const factor = rows[0].data.leg_load_multiplier
  const leg_tension_kg = (input.load_kg * factor) / input.num_legs

  return ok({ leg_tension_kg, factor }, rows as RefRow<unknown>[])
}

// ---------------------------------------------------------------------------
// snatchBlockLoad
// ---------------------------------------------------------------------------

export async function snatchBlockLoad(
  input: { line_pull_kg: number; deflection_angle_deg: number; standard?: string },
  ref: ReferenceAdapter,
): Promise<CalcResult<{ block_load_kg: number; factor: number }>> {
  const rows = await ref.getSnatchBlockFactor({ deflection_angle_deg: input.deflection_angle_deg })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_snatch_block_factors', { deflection_angle_deg: input.deflection_angle_deg }))
  }

  const verifyErr = checkVerified(rows as RefRow<unknown>[], 'ref_snatch_block_factors')
  if (verifyErr) return err(verifyErr)

  const factor = rows[0].data.block_load_multiplier
  const block_load_kg = input.line_pull_kg * factor

  return ok({ block_load_kg, factor }, rows as RefRow<unknown>[])
}

// ---------------------------------------------------------------------------
// shackleSWL
// ---------------------------------------------------------------------------

export async function shackleSWL(
  input: { bow_size_in?: string; applied_load_kg: number },
  ref: ReferenceAdapter,
): Promise<CalcResult<{ swl_kg: number; bow_size_in: string }>> {
  const rows = await ref.getShackle({ bow_size_in: input.bow_size_in })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_shackles', { bow_size_in: input.bow_size_in }))
  }

  const verifyErr = checkVerified(rows as RefRow<unknown>[], 'ref_shackles')
  if (verifyErr) return err(verifyErr)

  const row = rows[0].data
  const swl_kg = row.wll_kg ?? 0

  if (input.applied_load_kg > swl_kg) {
    return err({ kind: 'ExceedsSWL', applied_load_kg: input.applied_load_kg, swl_kg })
  }

  return ok({ swl_kg, bow_size_in: row.bow_size_in }, rows as RefRow<unknown>[])
}

// ---------------------------------------------------------------------------
// wireRopeSWL
// ---------------------------------------------------------------------------

export async function wireRopeSWL(
  input: { diameter_in: string; applied_load_kg: number; rope_grade?: string },
  ref: ReferenceAdapter,
): Promise<CalcResult<{ swl_kg: number }>> {
  const rows = await ref.getWireRopeSling({ diameter_in: input.diameter_in, rope_grade: input.rope_grade })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_wire_rope_slings', { diameter_in: input.diameter_in }))
  }

  const verifyErr = checkVerified(rows as RefRow<unknown>[], 'ref_wire_rope_slings')
  if (verifyErr) return err(verifyErr)

  const row = rows[0].data
  // Convert short tons to kg: 1 short ton = 907.185 kg
  const swl_kg = (row.swl_vertical_short_tons ?? 0) * 907.185

  if (input.applied_load_kg > swl_kg) {
    return err({ kind: 'ExceedsSWL', applied_load_kg: input.applied_load_kg, swl_kg })
  }

  return ok({ swl_kg }, rows as RefRow<unknown>[])
}

// ---------------------------------------------------------------------------
// syntheticSlingWLL
// ---------------------------------------------------------------------------

export async function syntheticSlingWLL(
  input: { width_in: string; applied_load_kg: number },
  ref: ReferenceAdapter,
): Promise<CalcResult<{ wll_kg: number }>> {
  const rows = await ref.getSyntheticSling({ width_in: input.width_in })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_synthetic_slings', { width_in: input.width_in }))
  }

  const verifyErr = checkVerified(rows as RefRow<unknown>[], 'ref_synthetic_slings')
  if (verifyErr) return err(verifyErr)

  const row = rows[0].data
  const wll_kg = row.wll_vertical_kg ?? 0

  if (input.applied_load_kg > wll_kg) {
    return err({ kind: 'ExceedsSWL', applied_load_kg: input.applied_load_kg, swl_kg: wll_kg })
  }

  return ok({ wll_kg }, rows as RefRow<unknown>[])
}

// ---------------------------------------------------------------------------
// chainSlingWLL
// ---------------------------------------------------------------------------

export async function chainSlingWLL(
  input: { chain_size: string; applied_load_kg: number; safety_factor?: number },
  ref: ReferenceAdapter,
): Promise<CalcResult<{ wll_kg: number; safety_factor: number | null }>> {
  const rows = await ref.getChainSling({
    chain_size: input.chain_size,
    safety_factor: input.safety_factor,
  })

  if (rows.length === 0) {
    return err(makeMissingRef('ref_chain_slings', { chain_size: input.chain_size }))
  }

  const verifyErr = checkVerified(rows as RefRow<unknown>[], 'ref_chain_slings')
  if (verifyErr) return err(verifyErr)

  const row = rows[0].data
  const wll_kg = row.wll_single_vertical_kg ?? 0

  if (input.applied_load_kg > wll_kg) {
    return err({ kind: 'ExceedsSWL', applied_load_kg: input.applied_load_kg, swl_kg: wll_kg })
  }

  return ok(
    { wll_kg, safety_factor: input.safety_factor ?? null },
    rows as RefRow<unknown>[],
  )
}
