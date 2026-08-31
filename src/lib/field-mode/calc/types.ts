// ============================================================
// Field Mode Calc — Core Types
// Pure TypeScript. Zero framework/DB imports.
// ============================================================

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type CalcError =
  | { kind: 'ParseError'; input: string; reason: string }
  | { kind: 'MissingReferenceData'; table: string; query: Record<string, unknown> }
  | { kind: 'UnverifiedReferenceData'; table: string; row_id: string; recall_confidence: string }
  | { kind: 'ExceedsSWL'; applied_load_kg: number; swl_kg: number }
  | { kind: 'InvalidInput'; field: string; reason: string }

export function makeParseError(input: string, reason: string): CalcError {
  return { kind: 'ParseError', input, reason }
}

export function makeInvalidInput(field: string, reason: string): CalcError {
  return { kind: 'InvalidInput', field, reason }
}

export function makeMissingRef(table: string, query: Record<string, unknown>): CalcError {
  return { kind: 'MissingReferenceData', table, query }
}

// ---------------------------------------------------------------------------
// RefRow and CalcResult
// ---------------------------------------------------------------------------

export interface RefRow<T> {
  data: T
  row_id: string
  verified: boolean
  recall_confidence: 'high' | 'medium' | 'low' | 'computed' | 'unrated' | 'source-photo'
  source_doc: string
  standard: string | null
  edition: string | null
}

export type CalcResult<T> =
  | { ok: true; value: T; refs: RefRow<unknown>[]; warnings: string[] }
  | { ok: false; error: CalcError }

export function ok<T>(value: T, refs: RefRow<unknown>[], warnings?: string[]): CalcResult<T> {
  return { ok: true, value, refs, warnings: warnings ?? [] }
}

export function err(error: CalcError): CalcResult<never> {
  return { ok: false, error }
}

// ---------------------------------------------------------------------------
// Length — opaque type, internal mm
// ---------------------------------------------------------------------------

declare const _brand: unique symbol
export type Length = { readonly [_brand]: 'mm'; readonly _mm: number }

export function fromMm(mm: number): Length {
  if (!isFinite(mm)) throw makeInvalidInput('mm', 'must be finite')
  return { _mm: mm } as Length
}

export function fromInches(inches: number): Length {
  return fromMm(inches * 25.4)
}

export function fromMetres(m: number): Length {
  return fromMm(m * 1000)
}

export function toMm(l: Length): number {
  return l._mm
}

export function toInches(l: Length): number {
  return l._mm / 25.4
}

export function toMetres(l: Length): number {
  return l._mm / 1000
}

/**
 * Parse a length string. Handles:
 *   "1100mm"         → 1100 mm
 *   "1.1m"           → 1100 mm
 *   "5/16"           → 5/16 in
 *   "1-5/16"         → 1 5/16 in (hyphen as separator)
 *   "1 5/16"         → 1 5/16 in (space as separator)
 *   "43.3125"        → 43.3125 in (bare decimal = inches)
 *   "43 5/16"        → 43 5/16 = 43.3125 in (CRITICAL: space is fraction separator)
 *   "3' 7 5/16"      → (3×12 + 7 + 5/16) in
 *   "3' 7 5/16\""    → same
 *   "12'"            → 144 in
 *   "0"              → 0
 */
export function fromFeetInchesFraction(s: string): Length {
  const trimmed = s.trim()

  if (trimmed === '') {
    throw makeParseError(s, 'empty string')
  }

  // --- mm suffix ---
  if (/mm$/i.test(trimmed)) {
    const num = parseFloat(trimmed.slice(0, -2).trim())
    if (isNaN(num)) throw makeParseError(s, 'no parseable number before mm')
    return fromMm(num)
  }

  // --- m suffix (but not mm) ---
  if (/[^m]m$/i.test(trimmed) || /^[\d.\s+-]+m$/i.test(trimmed)) {
    const num = parseFloat(trimmed.slice(0, -1).trim())
    if (isNaN(num)) throw makeParseError(s, 'no parseable number before m')
    return fromMetres(num)
  }

  // --- feet-inches-fraction ---
  // Strip trailing quote (inch mark)
  let working = trimmed.replace(/"$/, '').trim()

  // Split on feet tick: "3' 7 5/16" -> feet="3", rest=" 7 5/16"
  let feetIn = 0
  if (working.includes("'")) {
    const parts = working.split("'")
    const feetStr = parts[0].trim()
    const feetNum = parseFloat(feetStr)
    if (isNaN(feetNum)) throw makeParseError(s, `cannot parse feet: "${feetStr}"`)
    feetIn = feetNum * 12
    working = parts.slice(1).join("'").trim()
    // remove trailing quote if any
    working = working.replace(/"$/, '').trim()
  }

  // Now `working` is something like "7 5/16", "5/16", "1-5/16", "43.3125", ""
  if (working === '') {
    return fromInches(feetIn)
  }

  // Find fraction n/d
  // Normalise hyphens used as separator (between whole and fraction) to space
  // but only when it looks like "digit-digit/digit" i.e. separator, not minus
  // Pattern: optional whole number, optional separator (space or hyphen), fraction
  // We'll parse by finding the fraction pattern first.
  const fractionMatch = working.match(/(\d+)\/(\d+)/)
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10)
    const denominator = parseInt(fractionMatch[2], 10)
    if (denominator === 0) throw makeParseError(s, 'denominator is zero')

    // Everything before the fraction (stripped of separating hyphen/space)
    const beforeFraction = working.slice(0, fractionMatch.index!).trim()
    // Remove trailing hyphen or space used as separator
    const wholeStr = beforeFraction.replace(/[-\s]+$/, '').trim()
    let wholeIn = 0
    if (wholeStr !== '') {
      wholeIn = parseFloat(wholeStr)
      if (isNaN(wholeIn)) throw makeParseError(s, `cannot parse whole inches: "${wholeStr}"`)
    }

    return fromInches(feetIn + wholeIn + numerator / denominator)
  }

  // No fraction — try bare number (decimal inches)
  const num = parseFloat(working)
  if (isNaN(num)) throw makeParseError(s, `no parseable number: "${working}"`)
  return fromInches(feetIn + num)
}

// ---------------------------------------------------------------------------
// Angle — opaque type, internal degrees
// ---------------------------------------------------------------------------

declare const _angleBrand: unique symbol
export type Angle = { readonly [_angleBrand]: 'deg'; readonly _deg: number }

export function fromDegrees(d: number): Angle {
  if (!isFinite(d)) throw makeInvalidInput('degrees', 'must be finite')
  return { _deg: d } as Angle
}

/**
 * Parse an angle string. Accepts:
 *   "22°30'"   → 22.5°
 *   "22.5"     → 22.5°
 *   "45"       → 45°
 */
export function fromDegreesMinutes(s: string): Angle {
  const trimmed = s.trim()
  // Check for degrees-minutes format: "22°30'"
  const dmMatch = trimmed.match(/^([\d.]+)[°d]\s*([\d.]+)'?$/)
  if (dmMatch) {
    const deg = parseFloat(dmMatch[1])
    const min = parseFloat(dmMatch[2])
    if (isNaN(deg) || isNaN(min)) throw makeParseError(s, 'cannot parse degrees-minutes')
    return fromDegrees(deg + min / 60)
  }
  // Plain decimal or integer
  const num = parseFloat(trimmed)
  if (isNaN(num)) throw makeParseError(s, 'cannot parse angle')
  return fromDegrees(num)
}

export function toDegrees(a: Angle): number {
  return a._deg
}

// ---------------------------------------------------------------------------
// Display formatter
// ---------------------------------------------------------------------------

export interface DisplayOpts {
  unit: 'imperial' | 'metric'
  precision: '1/32' | '1/16' | '1/8' | '1mm'
}

/**
 * Format a Length for display. This is the ONLY place rounding happens.
 * Imperial: e.g. "3' 7 5/16\""
 * Metric: e.g. "1100 mm"
 */
export function formatLength(l: Length, opts: DisplayOpts): string {
  if (opts.unit === 'metric') {
    const mm = toMm(l)
    if (opts.precision === '1mm') {
      return `${Math.round(mm)} mm`
    }
    return `${mm.toFixed(1)} mm`
  }

  // Imperial
  const totalInches = toInches(l)
  const negative = totalInches < 0
  const absInches = Math.abs(totalInches)

  let denominator: number
  switch (opts.precision) {
    case '1/32': denominator = 32; break
    case '1/16': denominator = 16; break
    case '1/8':  denominator = 8;  break
    default:     denominator = 16
  }

  // Round to nearest 1/denominator
  const totalUnits = Math.round(absInches * denominator)
  const wholeFrac = totalUnits % denominator
  const wholeInchesRounded = (totalUnits - wholeFrac) / denominator

  const totalFeet = Math.floor(wholeInchesRounded / 12)
  const wholeInchPart = wholeInchesRounded % 12

  // Reduce fraction
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const g = wholeFrac > 0 ? gcd(wholeFrac, denominator) : 1
  const numReduced = wholeFrac / g
  const denReduced = denominator / g

  const sign = negative ? '-' : ''
  let inchPart = ''
  if (wholeFrac > 0) {
    if (wholeInchPart > 0) {
      inchPart = `${wholeInchPart} ${numReduced}/${denReduced}"`
    } else {
      inchPart = `${numReduced}/${denReduced}"`
    }
  } else {
    if (wholeInchPart > 0 || totalFeet === 0) {
      inchPart = `${wholeInchPart}"`
    }
  }

  if (totalFeet > 0) {
    if (inchPart) {
      return `${sign}${totalFeet}' ${inchPart}`
    }
    return `${sign}${totalFeet}'`
  }
  return `${sign}${inchPart}`
}
