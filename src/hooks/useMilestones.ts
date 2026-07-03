'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Milestone {
  id:              string
  organization_id: string
  project_id:      string
  name:            string
  description:     string | null
  planned_date:    string | null
  actual_date:     string | null
  status:          'pending' | 'in_progress' | 'complete' | 'delayed'
  sort_order:      number
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

export type MilestoneStatus = Milestone['status']

export interface CreateMilestoneInput {
  name:         string
  description?: string | null
  planned_date?: string | null
  actual_date?:  string | null
  status?:       MilestoneStatus
  sort_order?:   number
}

export interface UpdateMilestoneInput extends Partial<CreateMilestoneInput> {
  id: string
}

export function useMilestones(projectId: string) {
  return useQuery<Milestone[]>({
    queryKey: ['milestones', projectId],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/milestones`)
      if (!res.ok) throw new Error('Failed to fetch milestones')
      const json = await res.json()
      return json.milestones as Milestone[]
    },
    enabled: !!projectId,
  })
}

export function useCreateMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMilestoneInput) => {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to create milestone')
      }
      const json = await res.json()
      return json.milestone as Milestone
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] })
    },
  })
}

export function useUpdateMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateMilestoneInput) => {
      const res = await fetch(`/api/projects/${projectId}/milestones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to update milestone')
      }
      const json = await res.json()
      return json.milestone as Milestone
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] })
    },
  })
}

export function useDeleteMilestone(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const res = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to delete milestone')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] })
    },
  })
}
