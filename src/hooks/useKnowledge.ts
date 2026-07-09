'use client'
import { apiFetch } from '@/lib/apiFetch'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ─────────────────────────────────────────────────────

export interface KnowledgeCategory {
  id:              string
  organization_id: string
  name:            string
  slug:            string
  description:     string | null
  color:           string
  is_default:      boolean
  sort_order:      number
  created_at:      string
}

export interface KnowledgeSource {
  id:                string
  organization_id:   string
  project_id:        string | null
  category_id:       string | null
  title:             string
  description:       string | null
  document_type:     string
  related_module:    string | null
  file_name:         string
  file_size:         number | null
  file_type:         string
  storage_path:      string
  public_url:        string | null
  tags:              string[]
  visibility:        string
  status:            string
  version:           string
  superseded_by:     string | null
  uploaded_by:       string
  processing_status: string
  chunk_count:       number
  created_at:        string
  updated_at:        string
  // Joined
  knowledge_categories?: { id: string; name: string; color: string; slug: string } | null
  projects?:             { id: string; name: string; project_number: string | null } | null
}

// ── Categories ────────────────────────────────────────────────

export function useKnowledgeCategories() {
  return useQuery<KnowledgeCategory[]>({
    queryKey: ['knowledge-categories'],
    queryFn:  () => apiFetch('/api/knowledge/categories').then(async r => {
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? 'Failed to fetch categories')
      return json
    }),
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
}

export function useCreateKnowledgeCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string }) =>
      apiFetch('/api/knowledge/categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed')
        return json
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-categories'] }),
  })
}

// ── Sources ───────────────────────────────────────────────────

interface SourceFilters {
  status?:         string
  category_id?:    string
  project_id?:     string
  document_type?:  string
  related_module?: string
  q?:              string
  limit?:          number
  offset?:         number
}

export function useKnowledgeSources(filters: SourceFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  return useQuery<{ sources: KnowledgeSource[]; total: number }>({
    queryKey: ['knowledge-sources', filters],
    queryFn:  () =>
      apiFetch(`/api/knowledge/sources?${params}`).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed')
        return json
      }),
    staleTime: 1000 * 30,
    retry: false,
  })
}

export function useKnowledgeSource(id: string | null) {
  return useQuery<KnowledgeSource>({
    queryKey: ['knowledge-source', id],
    queryFn:  () =>
      apiFetch(`/api/knowledge/sources/${id}`).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed')
        return json
      }),
    enabled: !!id,
  })
}

export function useUpdateKnowledgeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: unknown }) =>
      apiFetch(`/api/knowledge/sources/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed')
        return json
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-source', vars.id] })
    },
  })
}

export function useDeleteKnowledgeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/knowledge/sources/${id}`, { method: 'DELETE' }).then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed')
        return json
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-sources'] }),
  })
}

// ── Upload ────────────────────────────────────────────────────

export interface UploadKnowledgePayload {
  file:            File
  title:           string
  description?:    string
  document_type?:  string
  related_module?: string
  category_id?:    string
  project_id?:     string
  tags?:           string[]
  visibility?:     string
  version?:        string
}

// ── Ask AI ────────────────────────────────────────────────────

export interface KnowledgeAnswer {
  answer:   string
  sources:  Array<{
    chunk_id:      string
    source_id:     string
    title:         string
    document_type: string
    file_name:     string
    public_url:    string | null
    similarity:    number
  }>
  query_id: string | null
}

export function useAskKnowledge() {
  return useMutation({
    mutationFn: async (payload: { query: string; project_id?: string }): Promise<KnowledgeAnswer> => {
      const res = await apiFetch('/api/knowledge/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Ask failed')
      }
      return res.json()
    },
  })
}

// ── Upload ────────────────────────────────────────────────────

export function useUploadKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UploadKnowledgePayload) => {
      const fd = new FormData()
      fd.append('file', payload.file)
      fd.append('title', payload.title)
      if (payload.description)    fd.append('description',    payload.description)
      if (payload.document_type)  fd.append('document_type',  payload.document_type)
      if (payload.related_module) fd.append('related_module', payload.related_module)
      if (payload.category_id)    fd.append('category_id',    payload.category_id)
      if (payload.project_id)     fd.append('project_id',     payload.project_id)
      if (payload.tags)           fd.append('tags',           JSON.stringify(payload.tags))
      if (payload.visibility)     fd.append('visibility',     payload.visibility)
      if (payload.version)        fd.append('version',        payload.version)

      const res = await apiFetch('/api/knowledge/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      return json as KnowledgeSource
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-sources'] })
    },
  })
}
