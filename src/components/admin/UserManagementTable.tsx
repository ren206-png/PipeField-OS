'use client'
// ============================================================
// UserManagementTable — Platform admin view of all users
// Fetches from /api/admin/users with search + filter support.
// ============================================================
import { useState, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, X, ChevronDown, RefreshCw, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  organizations:   { id: string; name: string; subscription_tier: string; subscription_status: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  platform_admin:     'Platform Admin',
  organization_owner: 'Org Owner',
  administrator:      'Administrator',
  project_manager:    'Project Manager',
  foreman:            'Foreman',
  qa_inspector:       'QA/QC Inspector',
  shop_fabricator:    'Shop Fabricator',
  pipefitter:         'Pipefitter',
  client_viewer:      'Client Viewer',
}

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-success/20 text-green-300',
  invited:     'bg-info/20 text-blue-300',
  suspended:   'bg-warning/20 text-yellow-300',
  deactivated: 'bg-danger/20 text-red-300',
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function UserManagementTable() {
  const queryClient = useQueryClient()
  const [search,   setSearch]   = useState('')
  const [role,     setRole]     = useState('')
  const [status,   setStatus]   = useState('')
  const [page,     setPage]     = useState(1)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)

  const queryKey = ['admin-users', search, role, status, page]

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (role)   params.set('role',   role)
      if (status) params.set('status', status)

      const res = await apiFetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed to load users')
      return res.json() as Promise<{ users: AdminUser[]; total: number; page: number; per_page: number }>
    },
    staleTime: 2 * 60_000,
  })

  const updateUser = useMutation({
    mutationFn: async (payload: { user_profile_id: string; role?: string; status?: string }) => {
      const res = await apiFetch('/api/admin/users', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditUser(null)
    },
  })

  const clearFilters = useCallback(() => {
    setSearch(''); setRole(''); setStatus(''); setPage(1)
  }, [])

  const hasFilters = !!search || !!role || !!status
  const total      = data?.total ?? 0
  const perPage    = data?.per_page ?? 50
  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or email…"
            className="input pl-9 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-surface-500" />
            </button>
          )}
        </div>

        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(1) }}
          className="input w-auto"
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="input w-auto"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost text-sm flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <button onClick={() => refetch()} className="btn-ghost p-2" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <span className="text-xs text-surface-500 ml-auto">
          {total} user{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-x-auto">
        {isLoading && (
          <div className="p-12 text-center text-surface-500 text-sm">Loading…</div>
        )}
        {isError && (
          <div className="p-12 text-center text-red-400 text-sm">Failed to load users.</div>
        )}
        {!isLoading && !isError && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 text-left">
                {['Name / Email', 'Organization', 'Role', 'Status', 'Signed Up', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {data?.users?.map(u => (
                <tr key={u.id} className="hover:bg-surface-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-surface-100">{u.full_name}</p>
                    <p className="text-xs text-surface-500">{u.email}</p>
                    {u.phone && <p className="text-xs text-surface-600">{u.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-surface-200">{u.organizations?.name ?? '—'}</p>
                    {u.organizations && (
                      <p className="text-xs text-surface-500 capitalize">
                        {u.organizations.subscription_tier?.replace('_', ' ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      u.role === 'platform_admin'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-surface-700 text-surface-300'
                    )}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[u.status] ?? 'bg-surface-700 text-surface-400')}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditUser(u)}
                      className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {data?.users?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500 text-sm">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-surface-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={(id, role, status) => updateUser.mutate({ user_profile_id: id, role, status })}
          saving={updateUser.isPending}
          error={updateUser.error?.message ?? null}
        />
      )}
    </div>
  )
}

// ── Inline Edit Modal ──────────────────────────────────────────

function EditUserModal({
  user, onClose, onSave, saving, error,
}: {
  user:    AdminUser
  onClose: () => void
  onSave:  (id: string, role?: string, status?: string) => void
  saving:  boolean
  error:   string | null
}) {
  const [role,   setRole]   = useState(user.role)
  const [status, setStatus] = useState(user.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-surface-50">Edit User</h3>
          <button onClick={onClose} aria-label="Close" className="text-surface-500 hover:text-surface-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-surface-100">{user.full_name}</p>
          <p className="text-xs text-surface-500">{user.email}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input w-full">
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input w-full">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm" disabled={saving}>Cancel</button>
          <button
            onClick={() => onSave(user.id, role, status)}
            disabled={saving || (role === user.role && status === user.status)}
            className="btn-primary text-sm"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
