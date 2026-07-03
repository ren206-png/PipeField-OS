'use client'
// ============================================================
// WeldPhotos — full-featured photo management for a weld record
//   • Grid of thumbnails (3-col desktop, 2-col mobile)
//   • "Add Photos" button + drag-and-drop zone when empty
//   • Per-file upload progress indicator
//   • Delete button (X) on hover
//   • Lightbox: full-size image, caption, prev/next navigation
// ============================================================
import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import {
  Camera,
  Upload,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
} from 'lucide-react'
import {
  useWeldPhotos,
  useUploadWeldPhoto,
  useDeleteWeldPhoto,
  type WeldPhoto,
} from '@/hooks/useWeldPhotos'

// ── Constants ─────────────────────────────────────────────────
const MAX_FILE_SIZE  = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const
const ACCEPTED_ATTR  = ACCEPTED_TYPES.join(',')

// ── Types ─────────────────────────────────────────────────────
interface UploadState {
  name:     string
  progress: number   // 0–100 (simulated; actual XHR progress not available via fetch)
  done:     boolean
  error:    string | null
}

interface LightboxState {
  index: number
}

// ── Component ─────────────────────────────────────────────────
interface WeldPhotosProps {
  weldId: string
}

export function WeldPhotos({ weldId }: WeldPhotosProps) {
  const { data: photos = [], isLoading } = useWeldPhotos(weldId)
  const uploadMutation  = useUploadWeldPhoto()
  const deleteMutation  = useDeleteWeldPhoto()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploads,   setUploads]   = useState<UploadState[]>([])
  const [dragOver,  setDragOver]  = useState(false)
  const [lightbox,  setLightbox]  = useState<LightboxState | null>(null)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [globalErr, setGlobalErr] = useState<string | null>(null)

  // ── Validate file before upload ──────────────────────────────
  function validate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      return `"${file.name}" is not a supported image type (JPEG, PNG, WebP, HEIC).`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 10 MB size limit.`
    }
    return null
  }

  // ── Process a list of files ──────────────────────────────────
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setGlobalErr(null)

      for (const file of files) {
        const validationError = validate(file)
        if (validationError) {
          setGlobalErr(validationError)
          continue
        }

        // Add to upload list
        const idx = files.indexOf(file)
        setUploads(prev => [
          ...prev,
          { name: file.name, progress: 10, done: false, error: null },
        ])

        // Simulate progress while upload is in-flight
        const progressTimer = setInterval(() => {
          setUploads(prev =>
            prev.map((u, i) =>
              i === prev.length - (files.length - idx)
                ? { ...u, progress: Math.min(u.progress + 15, 85) }
                : u,
            ),
          )
        }, 300)

        try {
          await uploadMutation.mutateAsync({ weldId, file })
          clearInterval(progressTimer)
          setUploads(prev =>
            prev.map((u, i) =>
              i === prev.length - (files.length - idx)
                ? { ...u, progress: 100, done: true }
                : u,
            ),
          )
          // Remove from progress list after brief delay
          setTimeout(() => {
            setUploads(prev => prev.filter((_, i) => i !== prev.length - (files.length - idx)))
          }, 1200)
        } catch (err) {
          clearInterval(progressTimer)
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setUploads(prev =>
            prev.map((u, i) =>
              i === prev.length - (files.length - idx)
                ? { ...u, error: msg, progress: 0 }
                : u,
            ),
          )
        }
      }

      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weldId, uploadMutation],
  )

  // ── Drag & drop handlers ─────────────────────────────────────
  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }
  function onDragLeave() {
    setDragOver(false)
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    void handleFiles(files)
  }

  // ── File input change ────────────────────────────────────────
  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    void handleFiles(files)
  }

  // ── Delete handler ───────────────────────────────────────────
  async function handleDelete(photo: WeldPhoto) {
    setDeleteId(photo.id)
    try {
      await deleteMutation.mutateAsync({ weldId, photoId: photo.id })
    } catch (err) {
      setGlobalErr(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteId(null)
    }
  }

  // ── Lightbox helpers ─────────────────────────────────────────
  function openLightbox(index: number) {
    setLightbox({ index })
  }
  function closeLightbox() {
    setLightbox(null)
  }
  function lightboxPrev() {
    if (!lightbox) return
    setLightbox({ index: (lightbox.index - 1 + photos.length) % photos.length })
  }
  function lightboxNext() {
    if (!lightbox) return
    setLightbox({ index: (lightbox.index + 1) % photos.length })
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Global error banner */}
      {globalErr && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{globalErr}</span>
          <button onClick={() => setGlobalErr(null)} aria-label="Dismiss error">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="aspect-square rounded-xl bg-surface-700 animate-pulse" />
          ))}
        </div>
      )}

      {/* Photo grid */}
      {!isLoading && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="relative group rounded-xl overflow-hidden aspect-square bg-surface-700 cursor-pointer"
              onClick={() => openLightbox(idx)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.public_url}
                alt={photo.file_name}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Zoom icon (center) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white/80" />
                </div>
                {/* Delete button (top-right) */}
                <button
                  onClick={e => { e.stopPropagation(); void handleDelete(photo) }}
                  disabled={deleteId === photo.id}
                  aria-label="Delete photo"
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full transition-colors"
                >
                  {deleteId === photo.id
                    ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    : <X className="w-3.5 h-3.5 text-white" />
                  }
                </button>
              </div>

              {/* Caption */}
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                  <p className="text-xs text-white/90 truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-file upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className="rounded-lg bg-surface-800 border border-surface-700 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-surface-300 truncate max-w-[80%]">{u.name}</span>
                {u.done && <span className="text-xs text-green-400 font-medium">Done</span>}
                {u.error && <span className="text-xs text-red-400">Failed</span>}
                {!u.done && !u.error && (
                  <span className="text-xs text-surface-500">{u.progress}%</span>
                )}
              </div>
              {u.error ? (
                <p className="text-xs text-red-400">{u.error}</p>
              ) : (
                <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${u.done ? 'bg-green-500' : 'bg-brand-500'}`}
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drag-and-drop zone (shown when no photos and not loading) */}
      {!isLoading && photos.length === 0 && uploads.length === 0 && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed cursor-pointer
            transition-all
            ${dragOver
              ? 'border-brand-400 bg-brand-500/10 text-brand-300'
              : 'border-surface-600 text-surface-500 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5'
            }
          `}
        >
          <Upload className={`w-8 h-8 ${dragOver ? 'text-brand-400' : 'text-surface-600'}`} />
          <div className="text-center">
            <p className="text-sm font-medium">
              {dragOver ? 'Drop photos here' : 'Drag photos here or click to upload'}
            </p>
            <p className="text-xs mt-1 text-surface-600">
              JPEG, PNG, WebP, HEIC · Max 10 MB per file
            </p>
          </div>
        </div>
      )}

      {/* Add Photos button (shown when photos already exist) */}
      {!isLoading && photos.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-600 text-surface-400 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 transition-all text-sm font-medium"
          >
            <Camera className="w-4 h-4" />
            Add Photos
          </button>
          <p className="self-center text-xs text-surface-600">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_ATTR}
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      {/* ── Lightbox ── */}
      {lightbox !== null && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Stop propagation on inner container so clicks on image/controls don't close */}
          <div
            className="relative max-w-4xl w-full mx-4 flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={closeLightbox}
              aria-label="Close lightbox"
              className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightbox.index]?.public_url}
              alt={photos[lightbox.index]?.file_name ?? ''}
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
            />

            {/* Caption */}
            {photos[lightbox.index]?.caption && (
              <p className="text-sm text-white/80 text-center px-4">
                {photos[lightbox.index]?.caption}
              </p>
            )}

            {/* Counter */}
            <p className="text-xs text-white/50">
              {lightbox.index + 1} / {photos.length}
            </p>

            {/* Navigation arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={lightboxPrev}
                  aria-label="Previous photo"
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 p-3 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={lightboxNext}
                  aria-label="Next photo"
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 p-3 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
