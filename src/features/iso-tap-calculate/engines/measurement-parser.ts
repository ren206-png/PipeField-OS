// ============================================================
// ISO Tap-to-Calculate — Measurement Parser (1A)
// Pure TypeScript. Zero framework/DB/browser imports.
// ============================================================

import type {
  Measurement,
  ParseError,
  AmbiguityError,
  ParseContext,
  ParseResult,
} from './schemas'

const MM_PER_INCH = 25.4
const INCHES_PER_FOOT = 12

// ---------------------------------------------------------------------------
// Unicode normalisation
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

function normalizeUnicode(s: string): string {
  let out = s
  // Unicode fraction characters — insert a separating space when a digit immediately precedes
  // the fraction character so "3¾" → "3 3/4" not "33/4"
  for (const [ch, replacement] of Object.entries(UNICODE_FRACTIONS)) {
    // Digit immediately before the fraction character → add a space
    out = out.replace(new RegExp(`(\\d)(${ch})`, 'g'), `$1 ${replacement}`)
    // All other occurrences (fraction at start, after space, etc.)
    out = out.replaceAll(ch, replacement)
  }
  // Unicode double quote marks → ASCII inch mark
  out = out.replace(/[""]/g, '"')
  // Unicode curly single quotes → ASCII apostrophe (feet mark)
  out = out.replace(/['']/g, "'")
  return out
}

// ---------------------------------------------------------------------------
// NPS callout detection
// "1/2 NPS", "NPS 2", "DN 15" → reject; "3/4\"" as a length → keep
// ---------------------------------------------------------------------------

const NPS_PATTERN = /(\d[\d./]*)\s*(NPS|DN|nps|dn)\b/
const NPS_PREFIX_PATTERN = /\bNPS\s*\d/i
const DN_PREFIX_PATTERN = /\bDN\s*\d/i

function isNpsCallout(s: string): boolean {
  return NPS_PATTERN.test(s) || NPS_PREFIX_PATTERN.test(s) || DN_PREFIX_PATTERN.test(s)
}

// ---------------------------------------------------------------------------
// Conflicting unit marker detection
// ---------------------------------------------------------------------------

function hasConflictingUnits(s: string): boolean {
  const hasMm = /\bmm\b/i.test(s)
  const hasIn = /(\bin\b|")/.test(s)
  const hasFt = /('|\bft\b)/i.test(s)
  const count = [hasMm, hasIn || hasFt].filter(Boolean).length
  return count > 1
}

// ---------------------------------------------------------------------------
// Fraction parser: "n/d" → number; throws on bad input
// Returns null if no fraction found
// ---------------------------------------------------------------------------

interface FractionParse {
  kind: 'fraction'
  value: number
  text: string
  index: number
  length: number
}

function extractFraction(s: string): FractionParse | ParseError {
  const match = s.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return { kind: 'parse-error', rawText: s, reason: 'No fraction found', code: 'MALFORMED_FRACTION' }

  const num = parseInt(match[1], 10)
  const den = parseInt(match[2], 10)

  if (den === 0) {
    return {
      kind: 'parse-error',
      rawText: s,
      reason: 'Denominator is zero',
      code: 'ZERO_DENOMINATOR',
    }
  }

  return {
    kind: 'fraction',
    value: num / den,
    text: match[0],
    index: match.index!,
    length: match[0].length,
  }
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

function makeError(rawText: string, reason: string, code: ParseError['code']): ParseError {
  return { kind: 'parse-error', rawText, reason, code }
}

function makeMeasurement(
  rawText: string,
  normalizedText: string,
  valueMm: number,
  originalUnit: Measurement['originalUnit'],
  sourceType: ParseContext['sourceType'],
): Measurement {
  return {
    kind: 'measurement',
    rawText,
    normalizedText,
    originalUnit,
    valueMm,
    valueIn: valueMm / MM_PER_INCH,
    sourceType,
    confirmed: false,
  }
}

export function parseMeasurement(raw: string, context: ParseContext): ParseResult {
  if (!raw || raw.trim() === '') {
    return makeError(raw, 'Empty input', 'MALFORMED_FRACTION')
  }

  // NPS callout check (before any normalisation)
  if (isNpsCallout(raw)) {
    return makeError(raw, 'Input appears to be a pipe-size callout (NPS/DN), not a length', 'NPS_CALLOUT')
  }

  // Normalise unicode
  const normalized = normalizeUnicode(raw.trim())

  // Conflicting units
  if (hasConflictingUnits(normalized)) {
    return makeError(raw, 'Input contains conflicting unit markers', 'CONFLICTING_UNITS')
  }

  // Negative check
  const isNegative = normalized.startsWith('-')
  if (isNegative && !context.allowNegative) {
    return makeError(raw, 'Negative values are not allowed in this context', 'NEGATIVE_NOT_ALLOWED')
  }

  // Strip leading sign for parsing, reapply as multiplier
  const sign = isNegative ? -1 : 1
  const unsigned = isNegative ? normalized.slice(1).trim() : normalized

  // ── mm ────────────────────────────────────────────────────────────────────
  if (/\bmm\b/i.test(unsigned)) {
    const numStr = unsigned.replace(/\bmm\b/i, '').trim()
    const val = parseFloat(numStr)
    if (isNaN(val) || !isFinite(val)) {
      return makeError(raw, 'Cannot parse number before "mm"', 'NONFINITE')
    }
    const mm = sign * val
    return makeMeasurement(raw, normalized, mm, 'mm', context.sourceType)
  }

  // ── feet-inches ───────────────────────────────────────────────────────────
  if (unsigned.includes("'")) {
    return parseFeetInches(raw, normalized, unsigned, sign, context.sourceType)
  }

  // ── plain inches with unit marker ─────────────────────────────────────────
  if (/"$/.test(unsigned) || /\bin\b/.test(unsigned)) {
    return parseInches(raw, normalized, unsigned, sign, context.sourceType)
  }

  // ── fraction without explicit inch marker (e.g. "3 3/4") ─────────────────
  // Treat as inches if it contains a "/"
  if (unsigned.includes('/')) {
    return parseInches(raw, normalized, unsigned + '"', sign, context.sourceType)
  }

  // ── bare number ──────────────────────────────────────────────────────────
  const bare = parseFloat(unsigned)
  if (isNaN(bare) || !isFinite(bare)) {
    return makeError(raw, 'Cannot parse number', 'NONFINITE')
  }

  // Ambiguous decimal separator: if the number has a comma (e.g. "1.000,5")
  if (unsigned.includes(',')) {
    return makeError(raw, 'Ambiguous decimal/thousands separator', 'AMBIGUOUS_SEPARATOR')
  }

  // Unitless — requires projectUnit confirmation
  if (!context.projectUnit) {
    return makeError(raw, 'Unitless value requires unit confirmation', 'UNITLESS_NEEDS_CONFIRMATION')
  }
  // projectUnit is always set per ParseContext, so use it
  const mm = context.projectUnit === 'mm'
    ? sign * bare
    : sign * bare * MM_PER_INCH
  const unit: Measurement['originalUnit'] = context.projectUnit === 'mm' ? 'mm' : 'in'
  return makeMeasurement(raw, normalized, mm, unit, context.sourceType)
}

// ---------------------------------------------------------------------------
// Feet-inches parser: "3'-2 3/4\"" or "3' 2 3/4\""
// ---------------------------------------------------------------------------

function parseFeetInches(
  raw: string,
  normalized: string,
  unsigned: string,
  sign: number,
  sourceType: ParseContext['sourceType'],
): ParseResult {
  const ftParts = unsigned.split("'")
  const feetStr = ftParts[0].trim()
  const feetNum = parseFloat(feetStr)
  if (isNaN(feetNum) || !isFinite(feetNum)) {
    return makeError(raw, `Cannot parse feet: "${feetStr}"`, 'MALFORMED_FRACTION')
  }

  const remainder = ftParts.slice(1).join("'").replace(/^[-\s]+/, '').replace(/"$/, '').trim()
  let inchesVal = 0

  if (remainder !== '') {
    const inchResult = parseInchValue(raw, remainder)
    if (inchResult.kind === 'parse-error') return inchResult
    inchesVal = inchResult.value
  }

  const totalInches = feetNum * INCHES_PER_FOOT + inchesVal
  const mm = sign * totalInches * MM_PER_INCH
  return makeMeasurement(raw, normalized, mm, 'ft-in', sourceType)
}

// ---------------------------------------------------------------------------
// Inches parser
// ---------------------------------------------------------------------------

function parseInches(
  raw: string,
  normalized: string,
  unsigned: string,
  sign: number,
  sourceType: ParseContext['sourceType'],
): ParseResult {
  // Strip inch marker
  const stripped = unsigned.replace(/"$/, '').replace(/\bin\b/i, '').trim()
  const result = parseInchValue(raw, stripped)
  if (result.kind === 'parse-error') return result
  const mm = sign * result.value * MM_PER_INCH
  return makeMeasurement(raw, normalized, mm, 'in', sourceType)
}

// ---------------------------------------------------------------------------
// Parse an inch string (no unit marker): "3 3/4", "3.75", "3/4"
// Returns { kind: 'value'; value: number } or ParseError
// ---------------------------------------------------------------------------

type InchValueResult = { kind: 'value'; value: number } | ParseError

function parseInchValue(raw: string, s: string): InchValueResult {
  // Check for malformed fraction: space before "/" (e.g. "3 /4")
  if (/\d\s+\//.test(s)) {
    return makeError(raw, 'Malformed fraction: space before slash', 'MALFORMED_FRACTION')
  }

  if (s.includes('/')) {
    const frac = extractFraction(s)
    if (frac.kind === 'parse-error') return frac

    const beforeFrac = s.slice(0, frac.index!).trim().replace(/[-\s]+$/, '').trim()
    let whole = 0
    if (beforeFrac !== '') {
      whole = parseFloat(beforeFrac)
      if (isNaN(whole) || !isFinite(whole)) {
        return makeError(raw, `Cannot parse whole part: "${beforeFrac}"`, 'MALFORMED_FRACTION')
      }
    }
    const value = whole + frac.value
    if (!isFinite(value)) return makeError(raw, 'Non-finite value', 'NONFINITE')
    return { kind: 'value', value }
  }

  const val = parseFloat(s)
  if (isNaN(val) || !isFinite(val)) {
    return makeError(raw, `Cannot parse inches: "${s}"`, 'NONFINITE')
  }
  return { kind: 'value', value: val }
}
