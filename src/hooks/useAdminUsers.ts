'use client'
import { useQuery } from '@tanstack/react-query'

interface AdminUser {
  id:              string
  auth_user_id:    string
  email:           string
  full_name:       string
  phone:           string | null
  role:            string
  status:          string
  created_at:      string
  last_sign_in_at: string | null
  organizations:   { id: string; name: string; subscription_tier: string } | null
}

interface UseAdminUsersOptions {
  search?:  string
  orgId?:   string
  role?:    string
  status?:  string
  page?:    number
}

export function useAdminUsers(opts: UseAdminUsersOptions = {}) {
  const { search = '', orgId = '', role = '', status = '', page = 1 } = opts

  return useQuery({
    queryKey: ['admin-users', search, orgId, role, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (orgId)  params.set('org_id', orgId)
      if (role)   params.set('role',   role)
      if (status) params.set('status', status)

      const res = await fetch(`/api/admin/users?${params}`)
      if (res.status === 403) throw new Error('Forbidden — platform admin only')
      if (!res.ok) throw new Error('Failed to load users')
      return res.json() as Promise<{
        users:    AdminUser[]
        total:    number
        page:     number
        per_page: number
      }>
    },
    staleTime: 30_000,
  })
}
