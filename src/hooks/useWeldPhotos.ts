'use client'
// ============================================================
// useWeldPhotos     — list photos for a weld (React Query)
// useUploadWeldPhoto — mutation: POST multipart/form-data
// useDeleteWeldPhoto — mutation: DELETE /photos/:photoId
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ─────────────────────────────────────────────────────
export interface WeldPhoto {
  id:           string
  organization_id: string
  weld_id:      string
  storage_path: string
  file_name:    string
  file_size:    number | null
  uploaded_by:  string | null
  caption:      string | null
  created_at:   string
  public_url:   string
}

// ── Query key factory ─────────────────────────────────────────
const photoKeys = {
  list: (weldId: string) => ['weld-photos', weldId] as const,
}

// ── useWeldPhotos ─────────────────────────────────────────────
export function useWeldPhotos(weldId: string) {
  return useQuery<WeldPhoto[]>({
    queryKey: photoKeys.list(weldId),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/welds/${weldId}/photos`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to load photos')
      }
      return res.json() as Promise<WeldPhoto[]>
    },
    enabled: !!weldId,
  })
}

// ── useUploadWeldPhoto ────────────────────────────────────────
export interface UploadPhotoArgs {
  weldId:  string
  file:    File
  caption?: string
}

export function useUploadWeldPhoto() {
  const qc = useQueryClient()

  return useMutation<WeldPhoto, Error, UploadPhotoArgs>({
    mutationFn: async ({ weldId, file, caption }) => {
      const fd = new FormData()
      fd.append('file', file)
      if (caption) fd.append('caption', caption)

      const res = await fetch(`/api/welds/${weldId}/photos`, {
        method: 'POST',
        body:   fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Upload failed')
      }
      return res.json() as Promise<WeldPhoto>
    },
    onSuccess: (_data, { weldId }) => {
      qc.invalidateQueries({ queryKey: photoKeys.list(weldId) })
    },
  })
}

// ── useDeleteWeldPhoto ────────────────────────────────────────
export interface DeletePhotoArgs {
  weldId:  string
  photoId: string
}

export function useDeleteWeldPhoto() {
  const qc = useQueryClient()

  return useMutation<{ success: boolean }, Error, DeletePhotoArgs>({
    mutationFn: async ({ weldId, photoId }) => {
      const res = await fetch(`/api/welds/${weldId}/photos/${photoId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Delete failed')
      }
      return res.json() as Promise<{ success: boolean }>
    },
    onSuccess: (_data, { weldId }) => {
      qc.invalidateQueries({ queryKey: photoKeys.list(weldId) })
    },
  })
}
