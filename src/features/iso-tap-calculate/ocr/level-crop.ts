// ============================================================
// ISO Tap-to-Calculate — Levelled-crop helpers for rotated dimensions
// Pure TypeScript: no DOM, canvas or Tesseract imports (unit-testable).
//
// Isometric dimensions are written along the pipe: ±30° or vertical.
// For a user's axis-aligned selection we try each candidate text angle,
// rotate the crop so the text is level, keep a one-line strip and erase
// the dimension line that runs along the text. Each attempt is OCR'd and
// the readings are ranked; the user picks the right one (values are never
// auto-confirmed).
// ============================================================

/** Text directions found on piping isometrics, in screen degrees (clockwise +). */
export const CANDIDATE_ANGLES = [0, 30, -30, 90, -90] as const
/** Upscale factors tried per angle; small dims read better enlarged. */
export const CANDIDATE_SCALES = [2, 3] as const

/** Dark/light threshold on luminance (0–255) after rotation. */
export const BINARIZE_THRESHOLD = 160

/**
 * Estimate the thickness of a single text line inside an axis-aligned box of
 * size w×h, assuming the text runs at `deg`. For a line of length L and
 * thickness t at angle θ: w = L·cosθ + t·sinθ and h = L·sinθ + t·cosθ.
 */
export function textLineThickness(w: number, h: number, deg: number): number {
  const a = Math.abs(deg)
  if (a === 90) return w
  if (a === 0) return h
  const r = (a * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const t = (h * c - w * s) / (c * c - s * s)
  // The estimate is meaningless when the box shape doesn't fit this angle;
  // fall back to the short side so the strip still contains the text.
  const shortSide = Math.min(w, h)
  return t > 4 && t <= shortSide ? t : shortSide
}

export interface LevelPlan {
  /** Output canvas size in pixels. */
  width: number
  height: number
  /** Estimated text-line thickness in output pixels. */
  linePx: number
  /** Horizontal dark runs longer than this are treated as drawing lines. */
  maxRunPx: number
}

/** Size of the levelled strip for a w×h selection at `deg`, upscaled by `scale`. */
export function planLevelledCrop(w: number, h: number, deg: number, scale: number): LevelPlan {
  const thickness = textLineThickness(w, h, deg) * 1.25
  const length = Math.hypot(w, h)
  const linePx = (thickness / 1.25) * scale
  return {
    width: Math.ceil(length * scale) + 30,
    height: Math.ceil(thickness * scale) + 30,
    linePx,
    // Character strokes are never wider than ~one glyph; drawing lines are.
    maxRunPx: Math.max(10, linePx * 0.8),
  }
}

/**
 * Binarise RGBA pixels in place and erase long horizontal dark runs
 * (the dimension/extension lines, now lying level).
 */
export function binarizeAndStripLines(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  maxRunPx: number,
  threshold = BINARIZE_THRESHOLD,
): void {
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11
    const v = lum < threshold ? 0 : 255
    px[i] = v
    px[i + 1] = v
    px[i + 2] = v
    px[i + 3] = 255
  }
  for (let y = 0; y < height; y++) {
    let x = 0
    while (x < width) {
      if (px[(y * width + x) * 4] === 0) {
        let end = x
        while (end < width && px[(y * width + end) * 4] === 0) end++
        if (end - x > maxRunPx) {
          for (let k = x; k < end; k++) {
            const i = (y * width + k) * 4
            px[i] = 255
            px[i + 1] = 255
            px[i + 2] = 255
          }
        }
        x = end
      } else {
        x++
      }
    }
  }
}

export interface RawReading<P = unknown> {
  text: string
  /** 0–1 */
  confidence: number
  angle: number
  scale: number
  /** Opaque payload carried through ranking (e.g. the preview image). */
  payload?: P
}

export interface RankedReading<P = unknown> extends RawReading<P> {
  score: number
}

const DRAWING_DENOMINATORS = new Set([2, 4, 8, 16, 32, 64])

/**
 * OCR often drops the space in a mixed number: "8 1/2" reads as "81/2",
 * which would parse as 40½. Drawings only use proper fractions with
 * denominators 2–64 and odd numerators, so an improper fraction is re-split
 * so the numerator is below the denominator. Returns every valid split
 * (e.g. "1215/16" → "12 15/16" and "121 5/16"), or [] if nothing to fix.
 */
export function fractionAlternatives(text: string): string[] {
  const m = text.match(/^(.*?)(\d{2,})\/(\d{1,2})(?!\d)(.*)$/)
  if (!m) return []
  const [, pre, numStr, denStr, post] = m
  if (/[\d/]$/.test(pre)) return []
  const den = parseInt(denStr, 10)
  if (!DRAWING_DENOMINATORS.has(den) || parseInt(numStr, 10) < den) return []
  const out: string[] = []
  for (const k of [2, 1]) {
    if (numStr.length <= k) continue
    const num = parseInt(numStr.slice(-k), 10)
    if (String(num).length !== k) continue // no leading zero
    if (num > 0 && num < den && num % 2 === 1) out.push(`${pre}${numStr.slice(0, -k)} ${num}/${den}${post}`)
  }
  return out
}

/** The most likely correction (first alternative), or the text unchanged. */
export function splitRunTogetherFraction(text: string): string {
  return fractionAlternatives(text)[0] ?? text
}

export function normalizeReading(text: string): string {
  return splitRunTogetherFraction(text.trim().replace(/\s+/g, ' '))
}

/** All texts a raw reading could stand for (fraction splits), normalised. */
function readingTexts(raw: string): string[] {
  const t = raw.trim().replace(/\s+/g, ' ')
  const alts = fractionAlternatives(t)
  return alts.length ? alts : [t]
}

/**
 * Rank OCR readings from the different angle/scale attempts.
 * Readings that parse as a length come first; within that, higher
 * confidence and more digits win (a wrong angle tends to yield one stray
 * glyph). Duplicate texts keep their best attempt.
 */
export function rankReadings<P>(
  readings: RawReading<P>[],
  isLength: (text: string) => boolean,
  limit = 3,
): RankedReading<P>[] {
  const best = new Map<string, RankedReading<P>>()
  for (const r of readings) for (const text of readingTexts(r.text)) {
    const digits = (text.match(/\d/g) ?? []).length
    if (digits === 0) continue
    const score = (isLength(text) ? 1 : 0) + r.confidence * Math.sqrt(digits) * 0.5
    const prev = best.get(text)
    if (!prev || score > prev.score) best.set(text, { ...r, text, score })
  }
  return Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, limit)
}
