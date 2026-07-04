'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'

interface Worker {
  id:            string
  email:         string
  full_name:     string
  phone:         string | null
  role:          string
  status:        string
  created_at:    string
  last_login_at: string | null
}

interface UseWorkersOptions {
  search?: string
  role?:   string
  status?: string
}

export function useWorkers(opts: UseWorkersOptions = {}) {
  const { search = '', role = '', status = '' } = opts

  return useQuery({
    queryKey: ['workers', search, role, status],
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (role)   params.set('role',   role)
      if (status) params.set('status', status)

      // apiFetch injects the Bearer token so the API can validate the session
      // even when the SSR cookie is missing or stale.
      const res = await apiFetch(`/api/organization/workers?${params}`)
      if (res.status === 403) throw new Error('Forbidden')
      if (!res.ok) throw new Error('Failed to load workers')
      return res.json() as Promise<{ workers: Worker[] }>
    },
    staleTime: 30_000,
  })
}
