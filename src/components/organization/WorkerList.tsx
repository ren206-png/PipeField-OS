'use client'
// ============================================================
// WorkerList — Org admin view of their workers
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X, UserPlus, MoreVertical, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InviteWorkerModal } from './InviteWorkerModal'
import { useOrganization } from '@/hooks/useOrganization'
import { getPlanCapabilities } from '@/lib/auth/permissions'
import { apiFetch } from '@/lib/apiFetch'

interface Worker {
  id:              string
  email:           string
  full_name:       string
  phone:           string | null
  role:            string
  status:          string
  created_at:      string
  last_login_at:   string | null
}

const ROLE_LABELS: Record<string, string> = {
  organization_owner: 'Org Owner',
  administrator:      'Administrator',
  project_manager:    'Project Manager',
  foreman:            'Foreman',
  qa_inspector:       'QA/QC Inspector',
  shop_fabricator:    'Shop Fabricator',
  pipefitter:         'Pipefitter',
  client_viewer:      'Client Viewer',
}

const CHANGEABLE_ROLES = [
  { value: 'administrator',   label: 'Administrator' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'foreman',         label: 'Foreman' },
  { value: 'qa_inspector',    label: 'QA/QC Inspector' },
  { value: 'shop_fabricator', label: 'Shop Fabricator' },
  { value: 'pipefitter',      label: 'Pipefitter' },
  { value: 'client_viewer',   label: 'Client Viewer' },
]

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-success/20 text-green-300',
  invited:     'bg-info/20 text-blue-300',
  suspended:   'bg-warning/20 text-yellow-300',
  deactivated: 'bg-danger/20 text-red-300',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function WorkerList() {
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const planCaps = getPlanCapabilities(organization?.subscription_tier ?? 'free_trial')

  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState('')
  const [showInvite,  setShowInvite]  = useState(false)
  const [menuId,      setMenuId]      = useState<string | null>(null)
  const [editWorker,  setEditWorker]  = useState<Worker | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workers', search, roleFilter],
    staleTime: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search)     params.set('search', search)
      if (roleFilter) params.set('role',   roleFilter)
      const res = await apiFetch(`/api/organization/workers?${params}`)
      if (!res.ok) throw new Error('Failed to load workers')
      return res.json() as Promise<{ workers: Worker[] }>
    },
  })

  const updateWorker = useMutation({
    mutationFn: async (payload: { worker_profile_id: string; role?: string; status?: string }) => {
      const res = await apiFetch('/api/organization/workers', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      setEditWorker(null)
      setMenuId(null)
    },
  })

  const removeWorker = useMutation({
    mutationFn: async (workerId: string) => {
      const res = await apiFetch(`/api/organization/workers?id=${workerId}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      setMenuId(null)
    },
  })

  const workers = data?.workers ?? []

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workers…"
            className="input pl-9 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-surface-500" />
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All roles</option>
          {CHANGEABLE_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <button onClick={() => refetch()} aria-label="Refresh member list" className="btn-ghost p-2" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <span className="text-xs text-surface-500">
          {workers.length} member{workers.length !== 1 ? 's' : ''}
        </span>

        {planCaps.canInviteUsers && (
          <button
            onClick={() => setShowInvite(true)}
            className="btn-primary flex items-center gap-2 ml-auto"
          >
            <UserPlus className="w-4 h-4" />
            Invite Worker
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="card overflow-x-auto">
        {isLoading && (
          <div className="p-12 text-center text-surface-500 text-sm">Loading…</div>
        )}
        {!isLoading && workers.length === 0 && (
          <div className="p-12 text-center text-surface-500 text-sm">
            No workers yet. Invite your first team member.
          </div>
        )}
        {!isLoading && workers.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 text-left">
                {['Name / Email', 'Role', 'Status', 'Joined', 'Last Login', ''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-surface-800/40 transition-colors relative">
                  <td className="px-4 py-3">
                    <p className="font-medium text-surface-100">{w.full_name}</p>
                    <p className="text-xs text-surface-500">{w.email}</p>
                    {w.phone && <p className="text-xs text-surface-600">{w.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-surface-700 text-surface-300 text-xs font-medium">
                      {ROLE_LABELS[w.role] ?? w.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[w.status] ?? 'bg-surface-700 text-surface-400')}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">{fmt(w.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">{fmt(w.last_login_at)}</td>
                  <td className="px-4 py-3 relative">
                    {/* Skip action menu for org owners */}
                    {w.role !== 'organization_owner' && (
                      <>
                        <button
                          onClick={() => setMenuId(menuId === w.id ? null : w.id)}
                          aria-label={`Actions for ${w.full_name}`}
                          aria-expanded={menuId === w.id}
                          className="p-1 text-surface-500 hover:text-surface-300 rounded"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuId === w.id && (
                          <div className="absolute right-8 top-2 z-20 bg-surface-800 border border-surface-700 rounded-xl shadow-xl w-44 overflow-hidden">
                            <button
                              onClick={() => { setEditWorker(w); setMenuId(null) }}
                              className="w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-700"
                            >
                              Change Role
                            </button>
                            <button
                              onClick={() => updateWorker.mutate({ worker_profile_id: w.id, status: w.status === 'active' ? 'suspended' : 'active' })}
                              className="w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-700"
                            >
                              {w.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${w.full_name} from your organization?`)) {
                                  removeWorker.mutate(w.id)
                                }
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Invite modal ── */}
      {showInvite && (
        <InviteWorkerModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['workers'] })}
        />
      )}

      {/* ── Edit role modal ── */}
      {editWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-surface-50">Change Role</h3>
              <button onClick={() => setEditWorker(null)} aria-label="Close" className="text-surface-500 hover:text-surface-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-sm font-medium text-surface-100">{editWorker.full_name}</p>
              <p className="text-xs text-surface-500">{editWorker.email}</p>
            </div>

            <RoleSelect
              current={editWorker.role}
              onSave={(newRole) => updateWorker.mutate({ worker_profile_id: editWorker.id, role: newRole })}
              saving={updateWorker.isPending}
              onCancel={() => setEditWorker(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function RoleSelect({
  current, onSave, saving, onCancel,
}: {
  current: string
  onSave: (role: string) => void
  saving:  boolean
  onCancel: () => void
}) {
  const [role, setRole] = useState(current)

  return (
    <div className="space-y-4">
      <div>
        <label className="label">New Role</label>
        <select value={role} onChange={e => setRole(e.target.value)} className="input w-full">
          {CHANGEABLE_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-ghost text-sm" disabled={saving}>Cancel</button>
        <button
          onClick={() => onSave(role)}
          disabled={saving || role === current}
          className="btn-primary text-sm"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
