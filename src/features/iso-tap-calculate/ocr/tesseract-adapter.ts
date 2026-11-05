// ============================================================
// ISO Tap-to-Calculate — Tesseract.js OCR Adapter
// Lazy-loads Tesseract.js so the ~9MB OCR assets are not bundled
// when PFOS_FIELD_ISO_CALC is OFF.
//
// CSP requirement: worker-src blob: 'self' must be set in
// next.config.mjs (already added).
//
// Tesseract char whitelist covers digits, fractions, common unit
// marks and separators only — keeps noise low on engineering dims.
//
// Bounding boxes are stored in canonical image coordinates
// (pre-rotation, pre-crop) — caller is responsible for transforming
// to viewport coordinates via OverlayCanvas.
// ============================================================

import type { OcrAdapter, OcrRegion, OcrResult } from './ocr-adapter'
import type { BoundingBox } from './types'

const CHAR_WHITELIST = "0123456789 '-./\"¾½¼⅛⅜⅝⅞mmincftMINFT"

/** Crop a Blob to the given pixel rectangle and return a new Blob. */
async function cropBlob(source: Blob, region: OcrRegion): Promise<Blob> {
  const bitmap = await createImageBitmap(source, region.x, region.y, region.width, region.height)
  const canvas = new OffscreenCanvas(region.width, region.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/png' })
}

export class TesseractAdapter implements OcrAdapter {
  // Tesseract.js Worker type is not exported from the package; any is intentional here.
  private worker: any = null // eslint-disable-line
  private _ready = false
  private initPromise: Promise<void> | null = null
  // Track the current job so stale results can be dropped
  private currentJobId = 0

  private async init(): Promise<void> {
    if (this._ready) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      // Dynamic import — Tesseract.js is only loaded here
      const { createWorker } = await import('tesseract.js')
      this.worker = await createWorker('eng', 1, {
        // Self-hosted assets from public/iso-calc-ocr/ (no CDN at runtime).
        // These files are copied from node_modules at build time and served locally.
        workerPath: '/iso-calc-ocr/tesseract-worker.min.js',
        // Directory, not a .wasm file: tesseract.js picks the best
        // tesseract-core-{relaxedsimd-,simd-,}lstm.wasm.js for this device.
        corePath:   '/iso-calc-ocr',
        langPath:   '/iso-calc-ocr/',
        // Load the worker from its same-origin URL. The default (a blob: URL)
        // is blocked by our CSP, which has no worker-src and no blob: in
        // script-src, so worker start-up failed with 'OCR failed'.
        workerBlobURL: false,
      })
      await this.worker.setParameters({
        tessedit_char_whitelist: CHAR_WHITELIST,
      })
      this._ready = true
    })()

    return this.initPromise
  }

  isReady(): boolean {
    return this._ready
  }

  async recognizeRegion(image: Blob, region?: OcrRegion): Promise<OcrResult> {
    await this.init()

    const jobId = ++this.currentJobId
    const target = region ? await cropBlob(image, region) : image

    // Pass the Blob itself. A blob: object URL would make tesseract fetch()
    // it, which the page CSP (connect-src has no blob:) blocks.
    const result = await this.worker.recognize(target, {}, { blocks: true })

    // If a newer job has started, discard this result
    if (jobId !== this.currentJobId) {
      return { rawText: '', confidence: 0, boundingBoxes: [], source: 'ocr' }
    }

    const boxes: BoundingBox[] = []
    const blocks = result.data.blocks ?? []
    for (const block of blocks) {
      for (const para of (block.paragraphs ?? [])) {
        for (const line of (para.lines ?? [])) {
          for (const word of (line.words ?? [])) {
            const bb = word.bbox
            if (!bb) continue
            // Bounding boxes are in cropped-image coordinates.
            // If a region was provided, offset back to canonical (pre-crop) coordinates.
            boxes.push({
              x0: bb.x0 + (region?.x ?? 0),
              y0: bb.y0 + (region?.y ?? 0),
              x1: bb.x1 + (region?.x ?? 0),
              y1: bb.y1 + (region?.y ?? 0),
              text: word.text,
              confidence: word.confidence / 100,
            })
          }
        }
      }
    }

    return {
      rawText: result.data.text,
      confidence: result.data.confidence / 100,
      boundingBoxes: boxes,
      source: 'ocr',
    }
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this._ready = false
      this.initPromise = null
    }
  }
}
