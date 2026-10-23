// ============================================================
// ISO Tap-to-Calculate — OCR Adapter Interface
// Concrete implementation: TesseractAdapter.
// This file defines only the interface — no Tesseract import here.
// Lazy-load the concrete adapter to ensure no OCR code loads
// when PFOS_FIELD_ISO_CALC is OFF.
// ============================================================

import type { OcrRegion, OcrResult } from './types'

export type { OcrRegion, OcrResult }

export interface OcrAdapter {
  /** Recognise text in the given image (or a sub-region of it). */
  recognizeRegion(image: Blob, region?: OcrRegion): Promise<OcrResult>
  /** True after the worker has been initialised. */
  isReady(): boolean
  /** Release the worker and all held resources. */
  dispose(): void
}
