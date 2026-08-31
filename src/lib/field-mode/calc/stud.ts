// ============================================================
// Field Mode Calc — Stud Bolt and Wrench Lookup
// Pure TypeScript. No framework/DB imports.
// ============================================================

import type { ReferenceAdapter, StudBoltRow } from './reference'
import {
  type CalcResult,
  type RefRow,
  ok,
  err,
  makeMissingRef,
} from './types'

export type StudLookupResult = {
  stud_dia_in: string | null
  stud_dia_mm: number | null
  stud_length_in: string | null
  stud_length_dec_in: number | null
  stud_length_mm: number | null
  studs_per_flange: number | null
  nut_wrench_size_heavy_hex_in: number | null
  nut_wrench_size_mm: number | null
  tpi: number | null
  thread_series: string | null
  standard: string | null
  edition: string | null
}

export async function studAndWrenchLookup(
  input: {
    nps: string
    flange_class: number
    standard?: string
    edition?: string
  },
  ref: ReferenceAdapter,
): Promise<CalcResult<StudLookupResult>> {
  const rows = await ref.getStudBolt({
    nps: input.nps,
    flange_class: input.flange_class,
    standard: input.standard,
  })

  if (rows.length === 0) {
    return err(
      makeMissingRef('ref_stud_bolts', {
        nps: input.nps,
        flange_class: input.flange_class,
        standard: input.standard,
      }),
    )
  }

  const allRefs: RefRow<unknown>[] = rows as RefRow<unknown>[]
  const row = rows[0].data

  return ok(
    {
      stud_dia_in: row.stud_dia_in,
      stud_dia_mm: row.stud_dia_mm,
      stud_length_in: row.stud_length_in,
      stud_length_dec_in: row.stud_length_dec_in,
      stud_length_mm: row.stud_length_mm,
      studs_per_flange: row.studs_per_flange,
      nut_wrench_size_heavy_hex_in: row.nut_wrench_size_heavy_hex_in,
      nut_wrench_size_mm: row.nut_wrench_size_mm,
      tpi: row.tpi,
      thread_series: row.thread_series,
      standard: row.standard,
      edition: row.edition,
    },
    allRefs,
  )
}
