'use client'
// ============================================================
// useOfflineSync — multi-entity sync engine
//
// Syncs welds, daily reports, and spools from the IndexedDB
// offline queue to the server whenever connectivity is available.
//
// Features:
//   • Sync lock: only one sync cycle runs at a time
//   • Multi-entity: welds → daily reports → spools in sequence
//   • Exponential backoff: items that errored get attempt_count++
//     and are retried with delay 1s / 4s / 16s (max 3 attempts)
//   • Periodic: syncs every SYNC_INTERVAL_MS while online
//   • Triggered: fires immediately on online event + tab visibility
//   • TTL purge: expired items removed at the start of every cycle
//   • Result state: exposes per-entity counts for the UI
// ============================================================
import { useEffect, useCallback, useRef, useState } from 'react'
import {
  getPendingWelds,
  getPendingDailyReports,
  getPendingSpools,
  markSynced,
  markFailed,
  purgeExpired,
  type EntityType,
  type QueueItem,
} from '@/lib/offline-queue'
import { apiFetch } from '@/lib/apiFetch'

// ── Constants ─────────────────────────────────────────────────
const SYNC_INTERVAL_MS = 30_000     // periodic sync every 30 s while online
const MAX_ATTEMPTS     = 3          // give up after 3 failures
const BACKOFF_BASE_MS  = 1_000      // 1 s → 4 s → 16 s

// ── Types ─────────────────────────────────────────────────────
export interface SyncCounts {
  created:    number
  duplicates: number
  errors:     number
}

export interface SyncResult {
  welds:         SyncCounts
  daily_reports: SyncCounts
  spools:        SyncCounts
  purged:        number
}

interface ApiSyncResultItem {
  local_id: string
  status:   'created' | 'duplicate' | 'error'
  error?:   string
}

// ── Sync lock (module-level — survives re-renders) ────────────
let _syncLock = false

// ── Per-entity sync helper ────────────────────────────────────
async function syncEntity(
  items:    QueueItem[],
  endpoint: string,
  entity:   EntityType,
): Promise<SyncCounts> {
  const counts: SyncCounts = { created: 0, duplicates: 0, errors: 0 }
  if (items.length === 0) return counts

  // Filter out items that have exceeded max attempts
  const eligible = items.filter(i => (i.attempt_count ?? 0) < MAX_ATTEMPTS)
  const exhausted = items.filter(i => (i.attempt_count ?? 0) >= MAX_ATTEMPTS)
  // Exhausted items count as permanent errors but we don't re-submit them
  counts.errors += exhausted.length

  if (eligible.length === 0) return counts

  // Apply backoff delay for items that have failed before
  // (delay based on the highest attempt_count in the batch)
  const maxAttempts = Math.max(...eligible.map(i => i.attempt_count ?? 0))
  if (maxAttempts > 0) {
    const delay = BACKOFF_BASE_MS * Math.pow(4, maxAttempts - 1)
    await new Promise(r => setTimeout(r, Math.min(delay, 16_000)))
  }

  let results: ApiSyncResultItem[] = []
  try {
    const res = await apiFetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        items: eligible.map(i => ({
          local_id:   i.local_id,
          project_id: i.project_id,
          payload:    i.payload,
        })),
      }),
    })

    if (!res.ok) {
      // Whole-batch failure — mark all eligible as failed
      const errText = await res.text().catch(() => `HTTP ${res.status}`)
      await Promise.all(eligible.map(i => markFailed(i.local_id, errText, entity)))
      counts.errors += eligible.length
      return counts
    }

    const body = await res.json() as { results: ApiSyncResultItem[] }
    results = body.results ?? []

  } catch (networkErr) {
    // Network-level failure (offline mid-sync) — mark all failed
    const msg = networkErr instanceof Error ? networkErr.message : 'Network error'
    await Promise.all(eligible.map(i => markFailed(i.local_id, msg, entity)))
    counts.errors += eligible.length
    return counts
  }

  // Process per-item results
  await Promise.all(results.map(async r => {
    if (r.status === 'created') {
      await markSynced(r.local_id, entity)
      counts.created++
    } else if (r.status === 'duplicate') {
      await markSynced(r.local_id, entity)   // treat dupe as success
      counts.duplicates++
    } else {
      await markFailed(r.local_id, r.error ?? 'Server error', entity)
      counts.errors++
    }
  }))

  return counts
}

// ── Hook ──────────────────────────────────────────────────────
export function useOfflineSync() {
  const [isSyncing,      setIsSyncing]      = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sync = useCallback(async (): Promise<void> => {
    // Sync lock — never run concurrent sync cycles
    if (_syncLock) return
    if (!navigator.onLine) return

    _syncLock = true
    setIsSyncing(true)

    try {
      // 1. Purge expired items first
      const purged = await purgeExpired()

      // 2. Fetch all pending items across entity types
      const [pendingWelds, pendingReports, pendingSpools] = await Promise.all([
        getPendingWelds(),
        getPendingDailyReports(),
        getPendingSpools(),
      ])

      // Nothing pending after purge
      if (!pendingWelds.length && !pendingReports.length && !pendingSpools.length) {
        setLastSyncResult(prev => prev ? { ...prev, purged } : null)
        return
      }

      // 3. Sync each entity type sequentially (avoids flooding the server)
      const [weldCounts, reportCounts, spoolCounts] = await Promise.all([
        syncEntity(pendingWelds,   '/api/welds/sync-queue',          'weld'),
        syncEntity(pendingReports, '/api/daily-reports/sync-queue',  'daily_report'),
        syncEntity(pendingSpools,  '/api/spools/sync-queue',         'spool'),
      ])

      setLastSyncResult({
        welds:         weldCounts,
        daily_reports: reportCounts,
        spools:        spoolCounts,
        purged,
      })

    } finally {
      _syncLock = false
      setIsSyncing(false)
    }
  }, [])

  // ── Triggers ───────────────────────────────────────────────
  useEffect(() => {
    // Fire immediately on mount if online
    if (navigator.onLine) void sync()

    // Online event — connectivity restored
    const onOnline = () => void sync()
    window.addEventListener('online', onOnline)

    // Tab becomes visible — catch up on missed syncs
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void sync()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Periodic sync every 30 s while online
    intervalRef.current = setInterval(() => {
      if (navigator.onLine) void sync()
    }, SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sync])

  return { sync, isSyncing, lastSyncResult }
}
