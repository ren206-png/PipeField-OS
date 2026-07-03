'use client'
import { useQuery } from '@tanstack/react-query'

export interface WeldByStatus {
  status: string
  count:  number
}

export interface WeldByWeek {
  week:   string
  total:  number
  passed: number
  failed: number
}

export interface TopWelder {
  name:   string
  stamp:  string
  total:  number
  passed: number
  rate:   number
}

export interface MilestoneProgress {
  name:     string
  status:   string
  due_date: string | null
}

export interface ProjectAnalytics {
  weldsByStatus:     WeldByStatus[]
  weldsByWeek:       WeldByWeek[]
  topWelders:        TopWelder[]
  milestoneProgress: MilestoneProgress[]
  rejectionRate:     number
  firstPassRate:     number
  totalWelds:        number
  completedWelds:    number
  completionPct:     number
}

export function useProjectAnalytics(projectId: string) {
  return useQuery<ProjectAnalytics>({
    queryKey: ['project-analytics', projectId],
    staleTime: 5 * 60_000,
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/analytics`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json() as Promise<ProjectAnalytics>
    },
  })
}
