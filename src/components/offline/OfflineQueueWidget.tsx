'use client'
// ============================================================
// OfflineQueueWidget — Header badge showing offline/online status
// and pending queue count. Sits in the top-right header bar.
//
// Shows:
//   • Green dot  — online, queue empty
//   • Amber dot  — online, items pending sync
//   • Red WifiOff icon — offline
//   • Sync button with spinner while syncing
//   • Transient toast when a sync cycle completes with results
// ============================================================
import { useEffect, useState, useRef } from 'react'
import { WifiOff, Wifi, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getPendingCount } from '@/lib/offline-queue'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface Props {
  enabled: boolean
}

export function OfflineQueueWidget({ enabled }: Props) {
  const isOnline                              = useOnlineStatus()
  const { sync, isSyncing, lastSyncResult }   = useOfflineSync()
  const [counts, setCounts]                   = useState({ total: 0, welds: 0, daily_reports: 0, spools: 0 })
  const [toast,  setToast]                    = useState<string | null>(null)
  const toastTimer                            = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refresh counts whenever sync state changes
  useEffect(() => {
    if (!enabled) return
    void getPendingCount().then(setCounts)
  }, [enabled, isSyncing, lastSyncResult])

  // Show a toast when sync completes and has content
  useEffect(() => {
    if (!lastSyncResult) return
    const { welds, daily_reports, spools } = lastSyncResult
    const total  = welds.created + daily_reports.created + spools.created
                 + welds.duplicates + daily_reports.duplicates + spools.duplicates
    const errors = welds.errors + daily_reports.errors + spools.errors
    if (total === 0 && errors === 0) return

    const parts: string[] = []
    if (total  > 0) parts.push(`${total} uploaded`)
    if (errors > 0) parts.push(`${errors} failed`)
    if (lastSyncResult.purged > 0) parts.push(`${lastSyncResult.purged} expired`)
    setToast(parts.join(' · '))

    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4_000)
  }, [lastSyncResult])

  if (!enabled) return null

  const hasPending = counts.total > 0

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Connection status icon */}
      <div className="relative flex items-center">
        {isOnline ? (
          <div className="relative">
            <Wifi className="w-4 h-4 text-surface-500" />
            <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-1 ring-surface-900 ${hasPending ? 'bg-amber-400' : 'bg-green-500'}`} />
          </div>
        ) : (
          <div className="relative">
            <WifiOff className="w-4 h-4 text-amber-400" />
            {hasPending && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[9px] font-bold bg-amber-500 text-white rounded-full leading-none">
                {counts.total > 99 ? '99+' : counts.total}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sync button — only shown online */}
      {isOnline && (
        <button
          onClick={() => void sync()}
          disabled={isSyncing}
          title={hasPending ? `${counts.total} item${counts.total !== 1 ? 's' : ''} pending` : 'Queue empty'}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing
            ? <Loader2   className="w-3 h-3 animate-spin" />
            : hasPending
            ? <RefreshCw className="w-3 h-3 text-amber-400" />
            : <CheckCircle2 className="w-3 h-3 text-green-500" />
          }
          {isSyncing ? 'Syncing…' : hasPending ? String(counts.total) : 'Synced'}
        </button>
      )}

      {/* Sync result toast */}
      {toast && (
        <div className="absolute top-8 right-0 z-50 whitespace-nowrap px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-200 shadow-lg animate-fade-in pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
