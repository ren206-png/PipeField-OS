// ============================================================
// Inch/mm recompute-and-compare check (master prompt non-negotiable
// rule 5: "import the inch column as the value of record ... and
// recompute mm at import so the conversion is yours and auditable").
//
// For every `<prefix>_in` column that has a sibling `<prefix>_mm`
// column in the same file, this recomputes mm = inches * 25.4
// (rounded to 1 decimal place, matching the README's own stated
// convention: "mm computed (x25.4, 1 dp)") from the inch value —
// which may be plain decimal or fraction notation ("2-1/2") — and
// compares it against the CSV's own mm value. A mismatch beyond
// rounding tolerance is a row-level validation failure: the row is
// rejected, not silently imported with disagreeing units. On a
// match, the recomputed value (not the CSV's raw mm text) is what
// gets written to the database, so the conversion is the importer's
// own and auditable, per rule 5.
// ============================================================
import { ColumnDef } from './schema-infer'
import { parseInchesLike } from './fraction'

export interface UnitPair {
  inCol: ColumnDef
  mmCol: ColumnDef
}

/** Tolerance in mm. Values are stored at 1 dp; allow for double-rounding drift. */
const TOLERANCE_MM = 0.15

export function findInMmPairs(cols: ColumnDef[]): UnitPair[] {
  const byDbColumn = new Map(cols.map((c) => [c.dbColumn, c]))
  const pairs: UnitPair[] = []
  for (const c of cols) {
    if (!c.dbColumn.endsWith('_in')) continue
    const mmName = c.dbColumn.slice(0, -3) + '_mm'
    const mmCol = byDbColumn.get(mmName)
    if (mmCol) pairs.push({ inCol: c, mmCol })
  }
  return pairs
}

export interface UnitCheckResult {
  /** Reasons for rows that must be rejected (mismatch beyond tolerance, or unparseable inch value). */
  reasons: string[]
  /** dbColumn -> recomputed mm value, to overwrite the CSV-supplied mm on rows that pass. */
  recomputedMm: Record<string, number>
}

export function checkAndRecomputeUnits(
  csvRow: Record<string, string>,
  pairs: UnitPair[]
): UnitCheckResult {
  const reasons: string[] = []
  const recomputedMm: Record<string, number> = {}

  for (const { inCol, mmCol } of pairs) {
    const inRaw = csvRow[inCol.csvHeader]
    const mmRaw = csvRow[mmCol.csvHeader]
    if (inRaw === undefined || inRaw === '' || mmRaw === undefined || mmRaw === '') {
      // One or both sparse — nothing to cross-check for this pair on this row.
      continue
    }
    const inches = parseInchesLike(inRaw)
    if (inches === null) {
      reasons.push(`${inCol.dbColumn}: could not parse "${inRaw}" as inches for mm recompute check`)
      continue
    }
    const mmFromCsv = Number(mmRaw)
    if (Number.isNaN(mmFromCsv)) {
      reasons.push(`${mmCol.dbColumn}: "${mmRaw}" is not a plain number`)
      continue
    }
    const recomputed = Math.round(inches * 25.4 * 10) / 10
    if (Math.abs(recomputed - mmFromCsv) > TOLERANCE_MM) {
      reasons.push(
        `${inCol.dbColumn}/${mmCol.dbColumn} disagree: "${inRaw}" recomputes to ${recomputed} mm, source has ${mmFromCsv} mm (tolerance ${TOLERANCE_MM} mm)`
      )
      continue
    }
    recomputedMm[mmCol.dbColumn] = recomputed
  }

  return { reasons, recomputedMm }
}
