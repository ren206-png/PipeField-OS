'use client'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

const MAX_ITEMS = 25
const MAX_BYTES = 100 * 1024 * 1024  // 100 MB
const TTL_MS   = 7 * 24 * 60 * 60 * 1000  // 7 days

export interface SupportPhotoQueueItem {
  client_photo_id: string      // device UUID (crypto.randomUUID())
  captured_at_client: string   // ISO timestamp
  blob: Blob                   // the actual photo
  size_bytes: number
  sync_status: 'pending' | 'synced' | 'failed' | 'expired'
  sync_error?: string
  queued_at: string
}

interface SupportPhotoDB extends DBSchema {
  support_photo_queue: {
    key: string   // client_photo_id
    value: SupportPhotoQueueItem
    indexes: { 'by-status': string; 'by-queued-at': string }
  }
}

let dbPromise: Promise<IDBPDatabase<SupportPhotoDB>> | null = null

function getDB(): Promise<IDBPDatabase<SupportPhotoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SupportPhotoDB>('pipefield-support-photos', 1, {
      upgrade(db) {
        const store = db.createObjectStore('support_photo_queue', { keyPath: 'client_photo_id' })
        store.createIndex('by-status', 'sync_status')
        store.createIndex('by-queued-at', 'queued_at')
      },
    })
  }
  return dbPromise
}

// Returns error string if queue is at limit, null if ok to enqueue
export async function checkQueueCapacity(newSizeBytes: number): Promise<string | null> {
  const db = await getDB()
  const all = await db.getAll('support_photo_queue')
  const pending = all.filter(i => i.sync_status === 'pending')
  if (pending.length >= MAX_ITEMS) {
    return `Queue full — maximum ${MAX_ITEMS} photos. Sync or delete existing items before capturing more.`
  }
  const totalBytes = pending.reduce((sum, i) => sum + i.size_bytes, 0)
  if (totalBytes + newSizeBytes > MAX_BYTES) {
    return `Queue storage full — maximum 100 MB. Sync or delete existing items before capturing more.`
  }
  return null
}

export async function enqueuePhoto(blob: Blob): Promise<SupportPhotoQueueItem> {
  const capacityError = await checkQueueCapacity(blob.size)
  if (capacityError) throw new Error(capacityError)

  const db = await getDB()
  const item: SupportPhotoQueueItem = {
    client_photo_id: crypto.randomUUID(),
    captured_at_client: new Date().toISOString(),
    blob,
    size_bytes: blob.size,
    sync_status: 'pending',
    queued_at: new Date().toISOString(),
  }
  await db.put('support_photo_queue', item)
  return item
}

export async function getAllQueuedPhotos(): Promise<SupportPhotoQueueItem[]> {
  const db = await getDB()
  return db.getAll('support_photo_queue')
}

export async function markPhotoSynced(client_photo_id: string): Promise<void> {
  const db = await getDB()
  const item = await db.get('support_photo_queue', client_photo_id)
  if (item) await db.put('support_photo_queue', { ...item, sync_status: 'synced' })
}

export async function markPhotoFailed(client_photo_id: string, error: string): Promise<void> {
  const db = await getDB()
  const item = await db.get('support_photo_queue', client_photo_id)
  if (item) await db.put('support_photo_queue', { ...item, sync_status: 'failed', sync_error: error })
}

export async function deleteQueuedPhoto(client_photo_id: string): Promise<void> {
  const db = await getDB()
  await db.delete('support_photo_queue', client_photo_id)
}

// Purge items older than 7 days WITHOUT uploading them
export async function purgeExpiredPhotos(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('support_photo_queue')
  const cutoff = Date.now() - TTL_MS
  let count = 0
  for (const item of all) {
    if (new Date(item.queued_at).getTime() < cutoff && item.sync_status === 'pending') {
      await db.put('support_photo_queue', { ...item, sync_status: 'expired' })
      count++
    }
  }
  return count
}

// Remove synced and expired items from the store
export async function clearCompleted(): Promise<void> {
  const db = await getDB()
  const all = await db.getAll('support_photo_queue')
  for (const item of all) {
    if (item.sync_status === 'synced' || item.sync_status === 'expired') {
      await db.delete('support_photo_queue', item.client_photo_id)
    }
  }
}
