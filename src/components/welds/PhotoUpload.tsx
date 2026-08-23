'use client'
import { useState, useRef } from 'react'
import { Camera, Upload, X, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface Photo {
  id:           string
  public_url:   string
  file_name:    string
  caption:      string | null
  storage_path: string
}

interface PhotoUploadProps {
  weldId:  string
  photos:  Photo[]
  orgId:   string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED      = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function PhotoUpload({ weldId, photos, orgId }: PhotoUploadProps) {
  const { profile }    = useAuth()
  const queryClient    = useQueryClient()
  const supabase       = createClient()
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !profile) return
    setError(null)
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        if (!ACCEPTED.includes(file.type)) {
          setError(`"${file.name}" is not a supported image type.`)
          continue
        }
        if (file.size > MAX_FILE_SIZE) {
          setError(`"${file.name}" exceeds 10 MB limit.`)
          continue
        }

        const ext  = file.name.split('.').pop() ?? 'jpg'
        const path = `${orgId}/${weldId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: upErr } = await supabase.storage
          .from('weld-photos')
          .upload(path, file)

        if (upErr) { setError(upErr.message); continue }

        const { data: { publicUrl } } = supabase.storage
          .from('weld-photos')
          .getPublicUrl(path)

        const { error: insertErr } = await supabase.from('weld_photos').insert({
          weld_id:         weldId,
          organization_id: orgId,
          storage_path:    path,
          public_url:      publicUrl,
          file_name:       file.name,
          file_size:       file.size,
          uploaded_by:     profile.id,
        })
        if (insertErr) { setError(insertErr.message); continue }
      }

      queryClient.invalidateQueries({ queryKey: ['weld', weldId] })
      if (fileInputRef.current)   fileInputRef.current.value   = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(photoId: string, storagePath: string) {
    setDeleting(photoId)
    try {
      const { error: storageErr } = await supabase.storage.from('weld-photos').remove([storagePath])
      if (storageErr) { setError(storageErr.message); return }
      const { error } = await supabase.from('weld_photos').delete().eq('id', photoId)
      if (error) { setError(error.message); return }
      queryClient.invalidateQueries({ queryKey: ['weld', weldId] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-surface-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.public_url}
                alt={photo.file_name}
                className="w-full h-full object-cover"
              />
              {/* Delete overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => handleDelete(photo.id, photo.storage_path)}
                  disabled={deleting === photo.id}
                  className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full transition-colors"
                  aria-label="Delete photo"
                >
                  {deleting === photo.id
                    ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                    : <X className="w-4 h-4 text-white" />
                  }
                </button>
              </div>
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                  <p className="text-xs text-white truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload buttons */}
      <div className="flex gap-2">
        {/* Camera — opens device camera on mobile */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-surface-600 text-surface-400 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 transition-all text-sm font-medium"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Camera'}
        </button>

        {/* File picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-surface-600 text-surface-400 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 transition-all text-sm font-medium"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <p className="text-xs text-surface-600 text-center">
        JPEG, PNG, WebP · Max 10 MB per photo
      </p>
    </div>
  )
}
