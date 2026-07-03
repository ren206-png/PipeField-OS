// ============================================================
// Project Service — server-side project operations
// ============================================================
import { createClient } from '@/lib/supabase/server'
import type { Project, ProjectStatus } from '@/types'

export async function getProjects(organizationId: string): Promise<Project[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Project
}

export interface CreateProjectInput {
  organization_id: string
  name: string
  project_number: string
  client_name?: string
  location?: string
  description?: string
  start_date?: string
  created_by: string
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: input.organization_id,
      name:            input.name,
      project_number:  input.project_number,
      client_name:     input.client_name ?? null,
      location:        input.location    ?? null,
      description:     input.description ?? null,
      start_date:      input.start_date  ?? null,
      status:          'active',
      created_by:      input.created_by,
    })
    .select()
    .single()
  if (error) throw error
  return data as Project
}
