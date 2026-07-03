'use client'
// ============================================================
// Share Link hooks — CRUD for /api/share-links
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ────────────────────────────────────────────────────
export interface ShareLinkProject {
  id:   string
  name: string
}

export interface ShareLink {
  id:         string
  token:      string
  label:      string
  expires_at: string | null
  views:      number
  created_at: string
  project_id: string | null
  projects:   ShareLinkProject | null
}

export interface CreateShareLinkInput {
  label:      string
  projectId?: string | null
  expiresAt?: string | null
}

// ── Fetch helpers ────────────────────────────────────────────
async function fetchLinks(): Promise<ShareLink[]> {
  const res = await fetch('/api/share-links')
  if (!res.ok) throw new Error('Failed to fetch share links')
  const json = await res.json() as { links: ShareLink[] }
  return json.links
}

async function createLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const res = await fetch('/api/share-links', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) {
    const json = await res.json() as { error: string }
    throw new Error(json.error ?? 'Failed to create share link')
  }
  const json = await res.json() as { link: ShareLink }
  return json.link
}

async function deleteLink(id: string): Promise<void> {
  const res = await fetch(`/api/share-links/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const json = await res.json() as { error: string }
    throw new Error(json.error ?? 'Failed to delete share link')
  }
}

// ── Hooks ─────────────────────────────────────────────────────
export function useShareLinks() {
  return useQuery<ShareLink[]>({
    queryKey: ['share-links'],
    queryFn:  fetchLinks,
    staleTime: 30_000,
  })
}

export function useCreateShareLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createLink,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}

export function useDeleteShareLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}
