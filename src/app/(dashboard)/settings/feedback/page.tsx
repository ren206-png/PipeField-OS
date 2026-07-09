'use client'
// ============================================================
// /settings/feedback — Admin view of all feedback submissions
// Only visible to organization administrators.
// ============================================================
import { useState } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { useQuery } from '@tanstack/react-query'
import {
  Star, MessageSquare, TrendingUp, Users,
  AlertCircle, Loader2, Filter,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface FeedbackRow {
  id:              string
  rating:          number
  category:        string
  comment:         string | null
  page_url:        string | null
  created_at:      string
  user_profiles?:  { full_name: string | null; email: string | null } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  general:     'General',
  bug:         'Bug Report',
  feature:     'Feature Request',
  ux:          'UX / Design',
  performance: 'Performance',
  other:       'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  general:     'bg-surface-700 text-surface-300',
  bug:         'bg-red-500/15 text-red-400',
  feature:     'bg-brand-500/15 text-brand-300',
  ux:          'bg-purple-500/15 text-purple-300',
  performance: 'bg-orange-500/15 text-orange-300',
  other:       'bg-surface-700 text-surface-300',
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-surface-600'}`}
        />
      ))}
    </div>
  )
}

export default function FeedbackAdminPage() {
  const { profile } = useAuth()
  const [filterRating,   setFilterRating]   = useState<number | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { data, isLoading, error } = useQuery<{ feedback: FeedbackRow[] }>({
    queryKey: ['admin-feedback'],
    queryFn:  async () => {
      const res = await apiFetch('/api/feedback')
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to load feedback')
      }
      return res.json()
    },
    enabled: profile?.role === 'administrator',
  })

  const allFeedback = data?.feedback ?? []

  // Summary stats
  const avgRating = allFeedback.length
    ? (allFeedback.reduce((s, f) => s + f.rating, 0) / allFeedback.length).toFixed(1)
    : '–'

  const countByRating = [5,4,3,2,1].map(r => ({
    rating: r,
    count:  allFeedback.filter(f => f.rating === r).length,
  }))

  // Filtered list
  const filtered = allFeedback.filter(f => {
    if (filterRating   !== null  && f.rating   !== filterRating)   return false
    if (filterCategory !== 'all' && f.category !== filterCategory) return false
    return true
  })

  if (profile?.role !== 'administrator') {
    return (
      <div className="p-8 text-surface-400 text-sm">
        Only organization administrators can view feedback.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">User Feedback</h1>
        <p className="text-sm text-surface-500 mt-1">
          Star ratings and comments submitted by your team.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total Responses',
            value: allFeedback.length,
            icon:  <MessageSquare className="w-5 h-5 text-brand-400" />,
            bg:    'bg-brand-500/10',
          },
          {
            label: 'Average Rating',
            value: avgRating,
            icon:  <Star className="w-5 h-5 text-yellow-400" />,
            bg:    'bg-yellow-500/10',
          },
          {
            label: 'This Week',
            value: allFeedback.filter(f => {
              const d = new Date(f.created_at)
              const now = new Date()
              return (now.getTime() - d.getTime()) < 7 * 86400 * 1000
            }).length,
            icon:  <TrendingUp className="w-5 h-5 text-green-400" />,
            bg:    'bg-green-500/10',
          },
          {
            label: 'Unique Users',
            value: new Set(allFeedback.map(f => f.user_profiles?.email).filter(Boolean)).size,
            icon:  <Users className="w-5 h-5 text-purple-400" />,
            bg:    'bg-purple-500/10',
          },
        ].map(card => (
          <div key={card.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center flex-shrink-0`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-surface-500">{card.label}</p>
              <p className="text-xl font-bold text-surface-50">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rating distribution */}
      {allFeedback.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-surface-300 mb-4">Rating Distribution</h2>
          <div className="space-y-2">
            {countByRating.map(({ rating: r, count }) => (
              <div key={r} className="flex items-center gap-3">
                <button
                  onClick={() => setFilterRating(filterRating === r ? null : r)}
                  className={`flex items-center gap-1 text-xs w-12 flex-shrink-0 font-medium transition-colors ${
                    filterRating === r ? 'text-yellow-400' : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  {r} <Star className="w-3 h-3" />
                </button>
                <div className="flex-1 bg-surface-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: allFeedback.length ? `${(count / allFeedback.length) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-surface-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </div>
        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {['all', ...Object.keys(CATEGORY_LABELS)].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
              }`}
            >
              {cat === 'all' ? 'All Categories' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {(filterRating !== null || filterCategory !== 'all') && (
          <button
            onClick={() => { setFilterRating(null); setFilterCategory('all') }}
            className="text-xs text-surface-500 hover:text-surface-300 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Feedback list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error instanceof Error ? error.message : 'Failed to load feedback'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback yet.</p>
          <p className="text-xs mt-1">Responses will appear here once your team submits ratings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => (
            <div key={fb.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <StarDisplay rating={fb.rating} />
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[fb.category] ?? CATEGORY_COLORS.other}`}>
                    {CATEGORY_LABELS[fb.category] ?? fb.category}
                  </span>
                </div>
                <div className="text-right text-xs text-surface-500">
                  <p>{fb.user_profiles?.full_name ?? fb.user_profiles?.email ?? 'Anonymous'}</p>
                  <p>{new Date(fb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              {fb.comment && (
                <p className="text-sm text-surface-300 leading-relaxed bg-surface-700/50 rounded-lg px-3 py-2.5">
                  &ldquo;{fb.comment}&rdquo;
                </p>
              )}

              {fb.page_url && (
                <p className="text-xs text-surface-600">Page: {fb.page_url}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
