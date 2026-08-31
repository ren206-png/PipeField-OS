// ============================================================
// Generic per-column type inference for reference CSVs.
//
// Rule: a column is NUMERIC only if every non-empty sampled value
// parses as a plain decimal number (optionally signed, optional
// decimal point). Anything else — fractions ("2-1/2", "3/4"),
// mixed feet-inch notation, free text, codes — stays TEXT. This is
// deliberate: many "_in" columns in these field-book/recall tables
// carry fraction notation as the value of record (master prompt
// rule 5 — "import the inch column as the value of record"), and a
// fraction string is not a valid SQL NUMERIC. Keeping it TEXT
// preserves the source value byte-for-byte; nothing is reformatted.
//
// `verified` and `derived` are special-cased to BOOLEAN because the
// CSVs use literal "true"/"false" strings for them.
// ============================================================
import { ParsedCsv } from './csv'

export type PgType = 'NUMERIC' | 'TEXT' | 'BOOLEAN'

export interface ColumnDef {
  /** Header exactly as it appears in the CSV (e.g. "hub_dia_base_X_in"). Used to read the row. */
  csvHeader: string
  /**
   * Postgres column name: the CSV header lower-cased. Unquoted SQL
   * identifiers are case-folded by Postgres anyway, and the master
   * prompt's own column-naming guidance says "snake_case" — a few
   * headers carry a single uppercase engineering-notation letter
   * (X, A, M, C, W, J for a named dimension, e.g. hub "at bevel A").
   * Lower-casing is the only change made; nothing is renamed,
   * reordered, or reworded.
   */
  dbColumn: string
  pgType: PgType
}

const BOOLEAN_COLUMNS = new Set(['verified', 'derived', 'rejected'])

const DECIMAL_RE = /^-?\d+(\.\d+)?$/

function isPlainDecimal(v: string): boolean {
  return DECIMAL_RE.test(v.trim())
}

export function inferColumns(csv: ParsedCsv): ColumnDef[] {
  return csv.headers.map((csvHeader) => {
    const dbColumn = sqlIdent(csvHeader)
    if (BOOLEAN_COLUMNS.has(csvHeader)) return { csvHeader, dbColumn, pgType: 'BOOLEAN' as PgType }

    let sawValue = false
    let allNumeric = true
    for (const row of csv.rows) {
      const v = row[csvHeader]
      if (v === undefined || v === '') continue
      sawValue = true
      if (!isPlainDecimal(v)) { allNumeric = false; break }
    }
    const pgType: PgType = sawValue && allNumeric ? 'NUMERIC' : 'TEXT'
    return { csvHeader, dbColumn, pgType }
  })
}

/** Lower-case a CSV header into a safe unquoted Postgres identifier. Throws on anything unexpected rather than guessing. */
export function sqlIdent(name: string): string {
  const lowered = name.toLowerCase()
  if (!/^[a-z][a-z0-9_]*$/.test(lowered)) {
    throw new Error(`Column name "${name}" (lower-cased: "${lowered}") is not a safe snake_case identifier`)
  }
  return lowered
}
