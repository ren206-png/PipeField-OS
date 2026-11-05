// ============================================================
// ISO Tap-to-Calculate — OCR Adapter Interface
// Concrete implementation: TesseractAdapter.
// This file defines only the interface — no Tesseract import here.
// Lazy-load the concrete adapter to ensure no OCR code loads
// when PFOS_FIELD_ISO_CALC is OFF.
// ============================================================

import type { OcrCandidate, OcrRegion, OcrResult } from './types'

export type { OcrCandidate, OcrRegion, OcrResult }

export interface OcrAdapter {
  /** Recognise text in the given image (or a sub-region of it). */
  recognizeRegion(image: Blob, region?: OcrRegion): Promise<OcrResult>
  /**
   * Read a single (possibly rotated) dimension in `region`: tries each
   * isometric text angle and returns the best few readings, best first.
   * `isLength` ranks readings that parse as a length above those that don't.
   */
  recognizeCandidates(
    image: Blob,
    region: OcrRegion,
    isLength: (text: string) => boolean,
  ): Promise<OcrCandidate[]>
  /** True after the worker has been initialised. */
  isReady(): boolean
  /** Release the worker and all held resources. */
  dispose(): void
}
