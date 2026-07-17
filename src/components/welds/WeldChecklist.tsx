'use client'
// ============================================================
// WeldChecklist — apply and complete inspection checklists
// on a weld record. Fetches templates + applied checklists,
// lets user apply a template and tick off items.
// ============================================================
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Plus, CheckSquare, Square, Loader2,
  Trash2, AlertCircle, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

interface ChecklistItem {
  id:         string
  label:      string
  required:   boolean
  checked:    boolean
  checked_at: string | null
  checked_by: string | null
}

interface WeldChecklist {
  id:            string
  template_name: string
  items:         ChecklistItem[]
  completed_at:  string | null
  created_at:    string
}

interface ChecklistTemplate {
  id:        string
  name:      string
  weld_type: string | null
  items:     { id: string; label: string; required: boolean }[]
}

// ── API helpers ───────────────────────────────────────────────

async function fetchChecklists(weldId: string): Promise<WeldChecklist[]> {
  const res = await apiFetch(`/api/welds/${weldId}/checklists`)
  if (!res.ok) throw new Error('Failed to load checklists')
  return res.json() as Promise<WeldChecklist[]>
}

async function fetchTemplates(): Promise<ChecklistTemplate[]> {
  const res = await apiFetch('/api/checklist-templates')
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json() as Promise<ChecklistTemplate[]>
}

// ── Single checklist ──────────────────────────────────────────

interface ChecklistCardProps {
  weldId:    string
  checklist: WeldChecklist
}

function ChecklistCard({ weldId, checklist }: ChecklistCardProps) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const total    = checklist.items.length
  const done     = checklist.items.filter(i => i.checked).length
  const allDone  = done === total

  const patchMutation = useMutation({
    mutationFn: async (items: ChecklistItem[]) => {
      const res = await apiFetch(`/api/welds/${weldId}/checklists/${checklist.id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ items }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as { error?: string }).error ?? 'Update failed')
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['weld-checklists', weldId] }),
    onError:   (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/welds/${weldId}/checklists/${checklist.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error('Delete failed')
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['weld-checklists', weldId] }),
    onError:   (err: Error) => setError(err.message),
  })

  function toggleItem(itemId: string) {
    const now  = new Date().toISOString()
    const next = checklist.items.map(i =>
      i.id === itemId
        ? { ...i, checked: !i.checked, checked_at: !i.checked ? now : null }
        : i
    )
    void patchMutation.mutate(next)
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors',
      allDone
        ? 'border-green-500/30 bg-green-500/5'
        : 'border-surface-700 bg-surface-800/50'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-surface-100 truncate">
              {checklist.template_name}
            </span>
            {allDone && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 font-medium">
                Complete
              </span>
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            {done}/{total} items checked
            {checklist.completed_at && (
              <> · Completed {new Date(checklist.completed_at).toLocaleDateString()}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(s => !s)}
            className="p-1.5 text-surface-500 hover:text-surface-300 hover:bg-surface-700 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => void deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="p-1.5 text-surface-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            {deleteMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', allDone ? 'bg-green-500' : 'bg-brand-500')}
          style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
        />
      </div>

      {/* Items */}
      {expanded && (
        <ul className="space-y-1.5">
          {checklist.items.map(item => (
            <li
              key={item.id}
              className={cn(
                'flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors select-none',
                item.checked
                  ? 'bg-green-500/5 text-surface-400'
                  : 'hover:bg-surface-700/50 text-surface-300'
              )}
              onClick={() => toggleItem(item.id)}
            >
              {patchMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin text-surface-600 flex-shrink-0 mt-0.5" />
                : item.checked
                  ? <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  : <Square className="w-4 h-4 text-surface-600 flex-shrink-0 mt-0.5" />
              }
              <span className={cn('text-sm flex-1', item.checked && 'line-through opacity-60')}>
                {item.label}
              </span>
              {item.required && !item.checked && (
                <span className="text-xs text-amber-500 font-medium flex-shrink-0">required</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

interface WeldChecklistProps {
  weldId: string
}

export function WeldChecklist({ weldId }: WeldChecklistProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [applying,   setApplying]   = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ['weld-checklists', weldId],
    queryFn:  () => fetchChecklists(weldId),
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn:  fetchTemplates,
    enabled:  showPicker,
  })

  async function applyTemplate(templateId: string) {
    setApplying(templateId)
    setApplyError(null)
    try {
      const res = await apiFetch(`/api/welds/${weldId}/checklists`, {
        method: 'POST',
        body:   JSON.stringify({ template_id: templateId }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as { error?: string }).error ?? 'Failed to apply template')
      }
      await qc.invalidateQueries({ queryKey: ['weld-checklists', weldId] })
      setShowPicker(false)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-surface-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* Checklist instances */}
      {!isLoading && checklists.map(cl => (
        <ChecklistCard key={cl.id} weldId={weldId} checklist={cl} />
      ))}

      {/* Empty state */}
      {!isLoading && checklists.length === 0 && !showPicker && (
        <div className="text-center py-8 text-surface-500">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 text-surface-700" />
          <p className="text-sm">No checklists applied yet.</p>
        </div>
      )}

      {/* Template picker */}
      {showPicker && (
        <div className="rounded-xl border border-surface-700 bg-surface-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-surface-200">Apply a template</p>
            <button onClick={() => setShowPicker(false)} className="text-surface-500 hover:text-surface-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-surface-500 py-2">
              No templates yet.{' '}
              <a href="/checklists" className="text-brand-400 hover:underline">Create one →</a>
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => void applyTemplate(t.id)}
                    disabled={!!applying}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-surface-700 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-200">{t.name}</p>
                      <p className="text-xs text-surface-500">
                        {t.items.length} items
                        {t.weld_type ? ` · ${t.weld_type}` : ''}
                      </p>
                    </div>
                    {applying === t.id
                      ? <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                      : <Plus className="w-4 h-4 text-surface-600" />
                    }
                  </button>
                </li>
              ))}
            </ul>
          )}

          {applyError && (
            <p className="text-xs text-red-400">{applyError}</p>
          )}
        </div>
      )}

      {/* Apply button */}
      {!showPicker && (
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          <Plus className="w-4 h-4" /> Apply checklist template
        </button>
      )}
    </div>
  )
}
