'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useOrganization } from './useOrganization'
import type { Project } from '@/types'

export function useProjects() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['projects', profile?.organization_id],
    staleTime: 5 * 60 * 1000, // projects change infrequently — 5 min
    queryFn: async (): Promise<Project[]> => {
      if (!profile?.organization_id) return []
      const { data, error } = await createClient()
        .from('projects')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Project[]
    },
    enabled: !!profile?.organization_id,
  })
}

// Lightweight hook for project selector dropdowns — only fetches id, name, project_number.
// Shares the same query key as the full list so it benefits from the same cache entry.
export interface ProjectListItem {
  id: string
  name: string
  project_number: string | null
}

export function useProjectsList() {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['projects-list', organizationId],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProjectListItem[]> => {
      if (!organizationId) return []
      const { data, error } = await createClient()
        .from('projects')
        .select('id, name, project_number')
        .eq('organization_id', organizationId)
        .order('name')
      if (error) throw error
      return (data ?? []) as ProjectListItem[]
    },
    enabled: !!organizationId,
  })
}
