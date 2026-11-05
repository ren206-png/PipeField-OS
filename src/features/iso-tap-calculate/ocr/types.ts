// ============================================================
// ISO Tap-to-Calculate — OCR Types
// Canonical coordinate system: pre-rotation, pre-crop image pixels.
// ============================================================

export interface OcrRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface BoundingBox {
  x0: number
  y0: number
  x1: number
  y1: number
  text: string
  confidence: number
}

/** One possible reading of a selected dimension (from one rotation attempt). */
export interface OcrCandidate {
  text: string
  confidence: number   // 0–1
  /** Text angle that produced it, in screen degrees (clockwise +). */
  angle: number
  /** The levelled crop the OCR read, for showing to the user. */
  preview: Blob
}

export interface OcrResult {
  rawText: string
  confidence: number   // 0–1 (Tesseract 0–100 normalised to 0–1)
  boundingBoxes: BoundingBox[]
  source: 'ocr'
}
