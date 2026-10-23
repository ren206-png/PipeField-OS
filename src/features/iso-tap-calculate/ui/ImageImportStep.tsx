'use client'
// ============================================================
// ISO Tap-to-Calculate — Step 1: Image Import / Capture
// ============================================================
// - file input with camera capture; works in browser + iOS Capacitor
// - EXIF stripped before display (browser-side, Blob only — no Buffer)
// - Hard limits: 20 MB file size; 8000×8000 px decoded
// - Object URL revoked on unmount / image change
// - "Skip — manual entry" always visible
// ============================================================
import React, { useRef, useEffect, useState } from 'react'
import type { BoundingBox } from '../ocr/types'
import { OverlayCanvas } from './OverlayCanvas'

interface ImageImportStepProps {
  onImageReady: (blob: Blob, url: string) => void
  onSkip: () => void
}

const MAX_FILE_BYTES = 20 * 1024 * 1024      // 20 MB
const MAX_DIMENSION  = 8000                   // px

/** Strip EXIF from JPEG in the browser (no Node Buffer needed). */
async function stripExifBrowser(blob: Blob): Promise<Blob> {
  if (blob.type !== 'image/jpeg') return blob
  const ab = await blob.arrayBuffer()
  const bytes = new Uint8Array(ab)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return blob

  const output: number[] = [0xFF, 0xD8]
  let i = 2
  while (i < bytes.length) {
    if (bytes[i] !== 0xFF) break
    const marker = bytes[i + 1]
    const segLen  = (bytes[i + 2] << 8) | bytes[i + 3]
    if (marker === 0xE1) { i += 2 + segLen; continue } // skip APP1 (EXIF/XMP)
    if (marker === 0xDA) { for (let j = i; j < bytes.length; j++) output.push(bytes[j]); break }
    for (let j = i; j < i + 2 + segLen; j++) output.push(bytes[j])
    i += 2 + segLen
  }
  return new Blob([new Uint8Array(output)], { type: 'image/jpeg' })
}

export function ImageImportStep({ onImageReady, onSkip }: ImageImportStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const [rotation, setRotation]         = useState<0 | 90 | 180 | 270>(0)
  const [error, setError]               = useState<string | null>(null)
  const [naturalSize, setNaturalSize]   = useState<{ w: number; h: number } | null>(null)
  const [blob, setBlob]                 = useState<Blob | null>(null)
  const urlRef = useRef<string | null>(null)

  // Revoke object URL on unmount
  useEffect(() => {
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }
  }, [])

  async function handleFile(file: File) {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`)
      return
    }
    // Validate decoded dimensions — not just filename/MIME
    let bm: ImageBitmap
    try {
      bm = await createImageBitmap(file)
    } catch {
      setError('Cannot decode image. Use JPEG, PNG, or WebP.')
      return
    }
    if (bm.width > MAX_DIMENSION || bm.height > MAX_DIMENSION) {
      bm.close()
      setError(`Image too large (${bm.width}×${bm.height} px). Maximum is ${MAX_DIMENSION}×${MAX_DIMENSION}.`)
      return
    }
    const dims = { w: bm.width, h: bm.height }
    bm.close()

    const stripped = await stripExifBrowser(file)

    // Revoke previous URL
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)

    const url = URL.createObjectURL(stripped)
    urlRef.current = url
    setPreviewUrl(url)
    setNaturalSize(dims)
    setRotation(0)
    setBlob(stripped)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  function rotate90() {
    setRotation(r => ((r + 90) % 360) as 0 | 90 | 180 | 270)
  }

  function handleContinue() {
    if (!blob || !previewUrl) return
    onImageReady(blob, previewUrl)
  }

  const rotatedStyle: React.CSSProperties = {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.2s ease',
    maxWidth: '100%',
    maxHeight: '60vw',
    objectFit: 'contain',
    touchAction: 'manipulation',
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-surface-400 text-sm">
        Photograph or import an isometric drawing. Dimensions will be read from the photo.
      </p>

      {/* Import / capture button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="min-h-[56px] rounded-xl border-2 border-dashed border-surface-600 bg-surface-900 text-surface-300 font-semibold flex items-center justify-center gap-2"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
        </svg>
        Import / Take Photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={handleInputChange}
        aria-label="Select or capture image"
      />

      {error && (
        <p className="text-red-400 text-sm rounded-xl bg-red-950/30 border border-red-800 px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {/* Preview */}
      {previewUrl && naturalSize && (
        <div className="relative flex items-center justify-center bg-surface-800 rounded-xl overflow-hidden min-h-[200px]">
          <img
            src={previewUrl}
            alt="Isometric drawing preview"
            style={rotatedStyle}
            draggable={false}
          />
          {/* Overlay canvas — no OCR boxes yet at this step */}
          <OverlayCanvas
            imageNaturalWidth={naturalSize.w}
            imageNaturalHeight={naturalSize.h}
            rotation={rotation}
            boxes={[] as BoundingBox[]}
          />
        </div>
      )}

      {previewUrl && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={rotate90}
            className="min-h-[56px] flex-1 rounded-xl bg-surface-800 border border-surface-700 text-surface-200 font-semibold flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21.5 2v6h-6M2.5 22v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21.5 8A9 9 0 1 1 5 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Rotate 90°
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="min-h-[56px] flex-1 rounded-xl bg-blue-700 text-white font-semibold"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Skip */}
      <button
        type="button"
        onClick={onSkip}
        className="min-h-[56px] rounded-xl bg-surface-800 text-surface-400 text-sm font-medium"
      >
        Skip — manual entry only
      </button>
    </div>
  )
}
