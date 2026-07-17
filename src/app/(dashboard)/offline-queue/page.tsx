'use client'
// ============================================================
// Offline Queue — management page
// Shows all queued items across entity types (welds, daily
// reports, spools) with per-entity tabs, sync controls,
// and retry/clear actions.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  WifiOff, Wifi, RefreshCw, Trash2, Plus,
  ChevronDown, ChevronUp, Loader2, Flame, ClipboardList, Package,
} from 'lucide-react'
import {
  getAllQueueItems,
  enqueueWeld,
  markPending,
  clearSynced,
  type QueueItem,
  type EntityType,
} from '@/lib/offline-queue'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  synced:  'bg-green-500/20  text-green-400  border-green-500/30',
  failed:  'bg-red-500/20    text-red-400    border-red-500/30',
}

const ENTITY_LABELS: Record<EntityType, string> = {
  weld:         'Welds',
  daily_report: 'Daily Reports',
  spool:        'Spools',
}

const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  weld:         Flame,
  daily_report: ClipboardList,
  spool:        Package,
}

type Tab = EntityType | 'all'

// ── Primary identifier per entity type ───────────────────────
function itemLabel(item: QueueItem): string {
  if (item.entity_type === 'weld')
    return (item.payload.weld_id_number as string | undefined) ?? '—'
  if (item.entity_type === 'daily_report')
    return (item.payload.report_date as string | undefined) ?? '—'
  if (item.entity_type === 'spool')
    return (item.payload.spool_number as string | undefined) ?? '—'
  return '—'
}

export default function OfflineQueuePage() {
  const isOnline                      = useOnlineStatus()
  const { sync, isSyncing }           = useOfflineSync()
  const [items,    setItems]          = useState<QueueItem[]>([])
  const [tab,      setTab]            = useState<Tab>('all')
  const [showAdd,  setShowAdd]        = useState(false)
  const [clearing, setClearing]       = useState(false)

  // Add weld form
  const [formProjectId,  setFormProjectId]  = useState('')
  const [formWeldNumber, setFormWeldNumber] = useState('')
  const [formJointType,  setFormJointType]  = useState('')
  const [formProcess,    setFormProcess]    = useState('')
  const [formDate,       setFormDate]       = useState('')
  const [adding,         setAdding]         = useState(false)

  const loadItems = useCallback(async () => {
    const all = await getAllQueueItems()
    setItems(all)
  }, [])

  useEffect(() => { void loadItems() }, [loadItems, isSyncing])

  // ── Derived counts ─────────────────────────────────────────
  const byType = (type: EntityType) => items.filter(i => i.entity_type === type)
  const pending  = items.filter(i => i.sync_status === 'pending').length
  const synced   = items.filter(i => i.sync_status === 'synced').length
  const failed   = items.filter(i => i.sync_status === 'failed').length

  const displayed = tab === 'all' ? items : items.filter(i => i.entity_type === tab)

  // ── Actions ────────────────────────────────────────────────
  async function handleClearSynced() {
    setClearing(true)
    await clearSynced()
    await loadItems()
    setClearing(false)
  }

  async function handleRetry(item: QueueItem) {
    await markPending(item.local_id, item.entity_type)
    await loadItems()
    void sync()
  }

  async function handleAddWeld(e: React.FormEvent) {
    e.preventDefault()
    if (!formProjectId.trim() || !formWeldNumber.trim()) return
    setAdding(true)
    try {
      await enqueueWeld(formProjectId.trim(), {
        weld_id_number: formWeldNumber.trim(),
        joint_type:     formJointType.trim() || undefined,
        process:        formProcess.trim()    || undefined,
        weld_date:      formDate              || undefined,
      })
      setFormProjectId(''); setFormWeldNumber(''); setFormJointType(''); setFormProcess(''); setFormDate('')
      await loadItems()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            {isOnline
              ? <Wifi    className="w-4 h-4 text-green-400" />
              : <WifiOff className="w-4 h-4 text-amber-400" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-50">Offline Queue</h1>
            <p className="text-sm text-surface-500">
              {isOnline ? 'Connected — items sync automatically' : 'Offline — items will sync on reconnect'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void sync()}
            disabled={isSyncing || !isOnline || pending === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </button>
          <button
            onClick={() => void handleClearSynced()}
            disabled={clearing || synced === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear Synced
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { label: 'Pending', count: pending, color: 'text-amber-400' },
          { label: 'Synced',  count: synced,  color: 'text-green-400' },
          { label: 'Failed',  count: failed,  color: 'text-red-400'   },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
            <span className="text-xs text-surface-500">{label}</span>
            <span className={`text-sm font-bold ${color}`}>{count}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700">
          <span className="text-xs text-surface-500">Total</span>
          <span className="text-sm font-bold text-surface-200">{items.length}</span>
        </div>
      </div>

      {/* Entity type tabs */}
      <div className="flex items-center gap-1 bg-surface-800 rounded-xl p-1 border border-surface-700 w-fit">
        {(['all', 'weld', 'daily_report', 'spool'] as Tab[]).map(t => {
          const count = t === 'all' ? items.length : byType(t as EntityType).length
          const Icon  = t === 'all' ? null : ENTITY_ICONS[t as EntityType]
          const label = t === 'all' ? 'All' : ENTITY_LABELS[t as EntityType]
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === t
                  ? 'bg-surface-700 text-surface-100 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {label}
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                tab === t ? 'bg-surface-600 text-surface-200' : 'bg-surface-700 text-surface-400'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Add Offline Weld (accordion) */}
      <div className="rounded-xl border border-surface-700 bg-surface-800 overflow-hidden">
        <button
          onClick={() => setShowAdd(s => !s)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-700/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-surface-200">
            <Plus className="w-4 h-4 text-brand-400" />
            Add Offline Weld
          </div>
          {showAdd ? <ChevronUp className="w-4 h-4 text-surface-500" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
        </button>
        {showAdd && (
          <div className="border-t border-surface-700 px-5 py-4">
            <form onSubmit={(e) => void handleAddWeld(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Project ID *', value: formProjectId, set: setFormProjectId, placeholder: 'UUID', required: true },
                { label: 'Weld Number *', value: formWeldNumber, set: setFormWeldNumber, placeholder: 'e.g. W-001', required: true },
                { label: 'Joint Type', value: formJointType, set: setFormJointType, placeholder: 'e.g. BW', required: false },
                { label: 'Process', value: formProcess, set: setFormProcess, placeholder: 'e.g. GTAW', required: false },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-surface-400 mb-1">{f.label}</label>
                  <input
                    type="text" value={f.value} required={f.required}
                    onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-600 text-surface-100 text-sm placeholder:text-surface-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Date</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-600 text-surface-100 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={adding}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to Queue
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Queue table */}
      <div className="rounded-xl border border-surface-700 bg-surface-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
            {tab === 'all' ? 'All Items' : ENTITY_LABELS[tab as EntityType]} ({displayed.length})
          </p>
        </div>
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-surface-600">
            <WifiOff className="w-8 h-8 mb-3" />
            <p className="text-sm font-medium">No items in queue</p>
            <p className="text-xs mt-1">Items captured offline will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Captured</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Attempts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Error</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {displayed.map(item => {
                  const Icon = ENTITY_ICONS[item.entity_type]
                  return (
                    <tr key={item.local_id} className="hover:bg-surface-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-surface-500" />
                          <span className="text-xs text-surface-500 capitalize">{item.entity_type.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-200 font-medium">{itemLabel(item)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-surface-400">{item.project_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-xs text-surface-500">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-surface-500">{item.attempt_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_BADGE[item.sync_status])}>
                          {item.sync_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-red-400 max-w-[200px] truncate">{item.sync_error ?? ''}</td>
                      <td className="px-4 py-3">
                        {item.sync_status === 'failed' && (item.attempt_count ?? 0) < 3 && (
                          <button
                            onClick={() => void handleRetry(item)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-surface-700 border border-surface-600 text-surface-300 hover:bg-surface-600 hover:text-surface-100 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}
                        {item.sync_status === 'failed' && (item.attempt_count ?? 0) >= 3 && (
                          <span className="text-xs text-surface-600">Max attempts</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
