// ============================================================
// Minimal fraction/decimal-inch string -> number parser, used only
// for IMPORT-TIME validation assertions (comparing values, sorting
// by NPS). This is NOT the Phase 2 calculator Length type — it is
// a narrow read-only helper so the importer can numerically compare
// values that are stored as TEXT (e.g. "2-1/2", "3/4") without
// altering what gets written to the database. Returns null (never
// throws, never guesses) on anything it can't parse confidently.
// ============================================================

export function parseInchesLike(raw: string): number | null {
  if (raw === undefined || raw === null) return null
  const s = raw.trim()
  if (s === '') return null

  // Plain decimal or integer: "9.5", "10", "-3"
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s)

  // Whole-and-fraction: "2-1/2", "1-7/16"
  let m = s.match(/^(-?\d+)-(\d+)\/(\d+)$/)
  if (m) {
    const whole = parseInt(m[1], 10)
    const num = parseInt(m[2], 10)
    const den = parseInt(m[3], 10)
    if (den === 0) return null
    const frac = num / den
    return whole < 0 ? whole - frac : whole + frac
  }

  // Whole space fraction: "1 5/16"
  m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) {
    const whole = parseInt(m[1], 10)
    const num = parseInt(m[2], 10)
    const den = parseInt(m[3], 10)
    if (den === 0) return null
    const frac = num / den
    return whole < 0 ? whole - frac : whole + frac
  }

  // Bare fraction: "3/4"
  m = s.match(/^(-?\d+)\/(\d+)$/)
  if (m) {
    const num = parseInt(m[1], 10)
    const den = parseInt(m[2], 10)
    if (den === 0) return null
    return num / den
  }

  return null
}

/** NPS sort key: "1/2" -> 0.5, "1-1/4" -> 1.25, "10" -> 10. Unparseable -> +Infinity (sorts last, never silently drops). */
export function npsSortKey(nps: string): number {
  const v = parseInchesLike(nps)
  return v === null ? Number.POSITIVE_INFINITY : v
}
