'use client'
// ============================================================
// offline-queue.ts  — IndexedDB offline capture queue
//
// Stores welds, daily reports, and spools captured while the
// device has no connectivity. On reconnect, the sync engine
// uploads them to the server.
//
// DB:      'pipefield-offline'  version 2
// Stores:  weld_queue | daily_report_queue | spool_queue
//
// Version 1 → 2 upgrade: adds daily_report_queue and spool_queue
// while keeping all existing weld_queue data intact.
//
// TTL: 30 days from created_at. Expired items are purged by
// purgeExpired() which runs at the start of every sync cycle.
// ============================================================
import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── TTL ───────────────────────────────────────────────────────
export const QUEUE_TTL_MS = 30 * 24 * 60 * 60 * 1000   // 30 days

export type SyncStatus = 'pending' | 'synced' | 'failed'
export type EntityType = 'weld' | 'daily_report' | 'spool'

// ── Shared base shape ─────────────────────────────────────────
interface BaseQueueItem {
  local_id:    string
  project_id:  string
  payload:     Record<string, unknown>
  created_at:  string
  sync_status: SyncStatus
  sync_error?: string
  synced_at?:  string
  attempt_count: number
}

export interface WeldQueueItem        extends BaseQueueItem { entity_type: 'weld' }
export interface DailyReportQueueItem extends BaseQueueItem { entity_type: 'daily_report' }
export interface SpoolQueueItem       extends BaseQueueItem { entity_type: 'spool' }

export type QueueItem = WeldQueueItem | DailyReportQueueItem | SpoolQueueItem

// ── IndexedDB schema ──────────────────────────────────────────
interface PipeFieldDB extends DBSchema {
  weld_queue: {
    key: string
    value: WeldQueueItem
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
  daily_report_queue: {
    key: string
    value: DailyReportQueueItem
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
  spool_queue: {
    key: string
    value: SpoolQueueItem
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
}

let dbPromise: Promise<IDBPDatabase<PipeFieldDB>> | null = null

function getDB(): Promise<IDBPDatabase<PipeFieldDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PipeFieldDB>('pipefield-offline', 2, {
      upgrade(db, oldVersion) {
        // Version 1 → 2: create new stores while preserving weld_queue
        if (oldVersion < 1) {
          const ws = db.createObjectStore('weld_queue', { keyPath: 'local_id' })
          ws.createIndex('by-sync-status', 'sync_status')
          ws.createIndex('by-project', 'project_id')
        }
        if (oldVersion < 2) {
          const ds = db.createObjectStore('daily_report_queue', { keyPath: 'local_id' })
          ds.createIndex('by-sync-status', 'sync_status')
          ds.createIndex('by-project', 'project_id')
          const ss = db.createObjectStore('spool_queue', { keyPath: 'local_id' })
          ss.createIndex('by-sync-status', 'sync_status')
          ss.createIndex('by-project', 'project_id')
        }
      },
    })
  }
  return dbPromise
}

// ── Generic enqueue ───────────────────────────────────────────
async function enqueue<T extends QueueItem>(
  store: keyof PipeFieldDB,
  item: T
): Promise<string> {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).put(store, item)
  return item.local_id
}

export async function enqueueWeld(
  projectId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const local_id = crypto.randomUUID()
  return enqueue('weld_queue', {
    local_id, project_id: projectId, payload,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
    entity_type: 'weld',
    attempt_count: 0,
  })
}

export async function enqueueDailyReport(
  projectId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const local_id = crypto.randomUUID()
  return enqueue('daily_report_queue', {
    local_id, project_id: projectId, payload,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
    entity_type: 'daily_report',
    attempt_count: 0,
  })
}

export async function enqueueSpool(
  projectId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const local_id = crypto.randomUUID()
  return enqueue('spool_queue', {
    local_id, project_id: projectId, payload,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
    entity_type: 'spool',
    attempt_count: 0,
  })
}

// ── Read ───────────────────────────────────────────────────────
export async function getPendingWelds(projectId?: string): Promise<WeldQueueItem[]> {
  const db = await getDB()
  if (projectId) {
    const all = await db.getAllFromIndex('weld_queue', 'by-project', projectId)
    return all.filter(i => i.sync_status === 'pending')
  }
  return db.getAllFromIndex('weld_queue', 'by-sync-status', 'pending')
}

export async function getPendingDailyReports(projectId?: string): Promise<DailyReportQueueItem[]> {
  const db = await getDB()
  if (projectId) {
    const all = await db.getAllFromIndex('daily_report_queue', 'by-project', projectId)
    return all.filter(i => i.sync_status === 'pending')
  }
  return db.getAllFromIndex('daily_report_queue', 'by-sync-status', 'pending')
}

export async function getPendingSpools(projectId?: string): Promise<SpoolQueueItem[]> {
  const db = await getDB()
  if (projectId) {
    const all = await db.getAllFromIndex('spool_queue', 'by-project', projectId)
    return all.filter(i => i.sync_status === 'pending')
  }
  return db.getAllFromIndex('spool_queue', 'by-sync-status', 'pending')
}

// Legacy alias used by existing page
export const getPendingItems = getPendingWelds

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const db = await getDB()
  const [welds, reports, spools] = await Promise.all([
    db.getAll('weld_queue'),
    db.getAll('daily_report_queue'),
    db.getAll('spool_queue'),
  ])
  return [...welds, ...reports, ...spools].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export async function getPendingCount(): Promise<{ welds: number; daily_reports: number; spools: number; total: number }> {
  const db = await getDB()
  const [w, d, s] = await Promise.all([
    db.getAllFromIndex('weld_queue',         'by-sync-status', 'pending'),
    db.getAllFromIndex('daily_report_queue', 'by-sync-status', 'pending'),
    db.getAllFromIndex('spool_queue',        'by-sync-status', 'pending'),
  ])
  return { welds: w.length, daily_reports: d.length, spools: s.length, total: w.length + d.length + s.length }
}

// ── Status updates ────────────────────────────────────────────
type Store = 'weld_queue' | 'daily_report_queue' | 'spool_queue'

function storeForType(entityType: EntityType): Store {
  if (entityType === 'weld')         return 'weld_queue'
  if (entityType === 'daily_report') return 'daily_report_queue'
  return 'spool_queue'
}

async function updateItem(
  store: Store,
  localId: string,
  patch: Partial<BaseQueueItem>
): Promise<void> {
  const db  = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx  = (db as any).transaction(store, 'readwrite')
  const item = await tx.store.get(localId)
  if (item) await tx.store.put({ ...item, ...patch })
  await tx.done
}

export async function markSynced(localId: string, entityType: EntityType = 'weld'): Promise<void> {
  await updateItem(storeForType(entityType), localId, {
    sync_status: 'synced', synced_at: new Date().toISOString(), sync_error: undefined,
  })
}

export async function markFailed(localId: string, error: string, entityType: EntityType = 'weld'): Promise<void> {
  const db   = await getDB()
  const store = storeForType(entityType)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = await (db as any).get(store, localId)
  await updateItem(store, localId, {
    sync_status:   'failed',
    sync_error:    error,
    attempt_count: (item?.attempt_count ?? 0) + 1,
  })
}

export async function markPending(localId: string, entityType: EntityType = 'weld'): Promise<void> {
  await updateItem(storeForType(entityType), localId, {
    sync_status: 'pending', sync_error: undefined,
  })
}

// ── Cleanup ───────────────────────────────────────────────────
export async function clearSynced(): Promise<number> {
  const db = await getDB()
  let count = 0
  for (const store of ['weld_queue', 'daily_report_queue', 'spool_queue'] as Store[]) {
    const synced: QueueItem[] = await db.getAllFromIndex(store, 'by-sync-status', 'synced')
    await Promise.all(synced.map(i => db.delete(store, i.local_id)))
    count += synced.length
  }
  return count
}

/**
 * Delete items older than QUEUE_TTL_MS from all stores.
 * Returns the number of items purged.
 */
export async function purgeExpired(): Promise<number> {
  const db       = await getDB()
  const cutoff   = Date.now() - QUEUE_TTL_MS
  let   purged   = 0
  for (const store of ['weld_queue', 'daily_report_queue', 'spool_queue'] as Store[]) {
    const all: QueueItem[] = await db.getAll(store)
    const expired = all.filter(i => new Date(i.created_at).getTime() < cutoff)
    await Promise.all(expired.map(i => db.delete(store, i.local_id)))
    purged += expired.length
  }
  return purged
}
