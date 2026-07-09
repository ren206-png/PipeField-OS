'use client'
// ============================================================
// /admin/overview — Platform metrics dashboard (developer only)
// Locked to platform_admin via the (admin) layout.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import {
  Users, Building2, TrendingUp, RefreshCw,
  CheckCircle2, AlertCircle, Clock, XCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

const TIER_LABELS: Record<string, string> = {
  free_trial:   'Free Trial',
  field_pro:    'Field Pro',
  starter:      'Starter',
  professional: 'Professional',
  enterprise:   'Enterprise',
}

const TIER_COLORS: Record<string, string> = {
  free_trial:   'bg-surface-700 text-surface-300',
  field_pro:    'bg-purple-500/20 text-purple-300',
  starter:      'bg-blue-500/20 text-blue-300',
  professional: 'bg-brand-500/20 text-brand-300',
  enterprise:   'bg-amber-500/20 text-amber-300',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  active:   <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  trialing: <Clock        className="w-3.5 h-3.5 text-brand-400" />,
  past_due: <AlertCircle  className="w-3.5 h-3.5 text-orange-400" />,
  canceled: <XCircle      className="w-3.5 h-3.5 text-red-400" />,
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Stats {
  totals:           { organizations: number; users: number }
  growth:           { new_orgs_30d: number; new_orgs_7d: number; new_users_30d: number; new_users_7d: number }
  tier_breakdown:   Record<string, number>
  status_breakdown: Record<string, number>
  recent_orgs:      { id: string; name: string; slug: string; subscription_tier: string; subscription_status: string; created_at: string }[]
  recent_users:     { id: string; full_name: string; email: string; role: string; status: string; created_at: string; organizations: { name: string } | null }[]
}

export default function AdminOverviewPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn:  async () => {
      const res = await apiFetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to load stats')
      return res.json()
    },
    staleTime: 60_000,
  })

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Platform Overview</h1>
          <p className="text-sm text-surface-500 mt-1">
            Real-time metrics across all organizations and users.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          Failed to load platform stats. Check your connection and try again.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label:    'Total Organizations',
            value:    data?.totals.organizations,
            sub:      `+${data?.growth.new_orgs_7d ?? 0} this week`,
            icon:     Building2,
            color:    'text-brand-400',
            bg:       'bg-brand-500/10',
          },
          {
            label:    'Total Users',
            value:    data?.totals.users,
            sub:      `+${data?.growth.new_users_7d ?? 0} this week`,
            icon:     Users,
            color:    'text-purple-400',
            bg:       'bg-purple-500/10',
          },
          {
            label:    'New Orgs (30d)',
            value:    data?.growth.new_orgs_30d,
            sub:      `${data?.growth.new_orgs_7d ?? 0} in last 7 days`,
            icon:     TrendingUp,
            color:    'text-green-400',
            bg:       'bg-green-500/10',
          },
          {
            label:    'New Users (30d)',
            value:    data?.growth.new_users_30d,
            sub:      `${data?.growth.new_users_7d ?? 0} in last 7 days`,
            icon:     TrendingUp,
            color:    'text-amber-400',
            bg:       'bg-amber-500/10',
          },
        ].map(card => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{card.label}</p>
            </div>
            {isLoading
              ? <div className="h-8 w-16 bg-surface-800 rounded animate-pulse" />
              : <p className="text-3xl font-bold text-surface-50">{card.value ?? 0}</p>
            }
            <p className="text-xs text-surface-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Plan & status breakdown ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Plan breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">Organizations by Plan</h2>
          {isLoading
            ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-surface-800 rounded animate-pulse" />)}</div>
            : (
              <div className="space-y-2">
                {['free_trial','field_pro','starter','professional','enterprise'].map(tier => {
                  const count = data?.tier_breakdown[tier] ?? 0
                  const total = data?.totals.organizations ?? 1
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={tier} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold w-28 text-center ${TIER_COLORS[tier]}`}>
                        {TIER_LABELS[tier]}
                      </span>
                      <div className="flex-1 bg-surface-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-surface-200 w-6 text-right">{count}</span>
                      <span className="text-xs text-surface-500 w-8">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>

        {/* Subscription status breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">Subscription Status</h2>
          {isLoading
            ? <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-surface-800 rounded animate-pulse" />)}</div>
            : (
              <div className="space-y-3">
                {['active','trialing','past_due','canceled','paused'].map(s => {
                  const count = data?.status_breakdown[s] ?? 0
                  if (count === 0) return null
                  return (
                    <div key={s} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                      <div className="flex items-center gap-2">
                        {STATUS_ICONS[s] ?? <Clock className="w-3.5 h-3.5 text-surface-500" />}
                        <span className="text-sm text-surface-300 capitalize">{s.replace('_', ' ')}</span>
                      </div>
                      <span className="text-sm font-bold text-surface-100">{count}</span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Recent orgs */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">Recently Joined Organizations</h2>
          {isLoading
            ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-surface-800 rounded animate-pulse" />)}</div>
            : data?.recent_orgs.length === 0
              ? <p className="text-sm text-surface-500">No organizations yet.</p>
              : (
                <div className="space-y-3">
                  {data?.recent_orgs.map(org => (
                    <div key={org.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-surface-100">{org.name}</p>
                        <p className="text-xs text-surface-500">{fmt(org.created_at)}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIER_COLORS[org.subscription_tier] ?? 'bg-surface-700 text-surface-400'}`}>
                        {TIER_LABELS[org.subscription_tier] ?? org.subscription_tier}
                      </span>
                    </div>
                  ))}
                </div>
              )
          }
        </div>

        {/* Recent users */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-200 mb-4">Recently Registered Users</h2>
          {isLoading
            ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-surface-800 rounded animate-pulse" />)}</div>
            : data?.recent_users.length === 0
              ? <p className="text-sm text-surface-500">No users yet.</p>
              : (
                <div className="space-y-3">
                  {data?.recent_users.map(u => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-surface-100">{u.full_name}</p>
                        <p className="text-xs text-surface-500">{u.email}</p>
                        <p className="text-xs text-surface-600">{u.organizations?.name ?? '—'}</p>
                      </div>
                      <p className="text-xs text-surface-500 text-right whitespace-nowrap">{fmt(u.created_at)}</p>
                    </div>
                  ))}
                </div>
              )
          }
        </div>
      </div>

      {/* ── Quick link to user management ── */}
      <div className="flex gap-3">
        <a
          href="/admin/users"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Users className="w-4 h-4" />
          Manage All Users
        </a>
      </div>

    </div>
  )
}
