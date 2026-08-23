'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Document, DocType } from '@/types'

export function useDocuments(projectId?: string, docType?: DocType) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['documents', projectId ?? 'all', docType ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<Document[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('documents')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      if (docType)   q = q.eq('document_type', docType)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Document[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useUploadDocument() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      metadata,
    }: {
      file: File
      metadata: Omit<Document, 'id'|'organization_id'|'storage_path'|'file_name'|'file_size'|'mime_type'|'uploaded_by'|'created_at'|'updated_at'|'project'>
    }) => {
      if (!profile?.organization_id) throw new Error('No org')

      // Upload to storage
      const path = `${profile.organization_id}/${metadata.project_id ?? 'general'}/${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      // Save metadata
      const { data, error } = await supabase
        .from('documents')
        .insert({
          ...metadata,
          organization_id: profile.organization_id,
          storage_path:    path,
          file_name:       file.name,
          file_size:       file.size,
          mime_type:       file.type,
          uploaded_by:     profile.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as Document
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useUpdateDocument() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Document> & { id: string }) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data as Document
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDeleteDocument() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, storage_path }: { id: string; storage_path: string }) => {
      const { error: storageErr } = await supabase.storage.from('project-documents').remove([storage_path])
      if (storageErr) throw storageErr
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDocumentUrl(storagePath: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['document-url', storagePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(storagePath, 3600) // 1 hour signed URL
      if (error) throw error
      return data?.signedUrl ?? null
    },
    enabled: !!storagePath,
    staleTime: 50 * 60 * 1000, // refresh before 1hr expiry
  })
}
