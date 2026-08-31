// ============================================================
// Field Mode Offline Reference Cache
// Caches reference table query results in IndexedDB.
// Keyed by table name + query fingerprint.
// TTL: 7 days (same as support photo queue pattern).
// ============================================================
'use client'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'pipefield-field-ref'
const DB_VERSION = 1
const STORE = 'ref_cache'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CacheEntry {
  key: string          // table + JSON(params)
  data: unknown[]
  cached_at: number    // Date.now()
  expires_at: number
}

interface RefCacheDB extends DBSchema {
  ref_cache: {
    key: string
    value: CacheEntry
    indexes: { 'by-expires': number }
  }
}

let dbPromise: Promise<IDBPDatabase<RefCacheDB>> | null = null

function getDB(): Promise<IDBPDatabase<RefCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RefCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('by-expires', 'expires_at')
      },
    })
  }
  return dbPromise
}

function makeKey(table: string, params: object): string {
  return `${table}:${JSON.stringify(params, Object.keys(params).sort())}`
}

export async function getCachedRef(table: string, params: object): Promise<unknown[] | null> {
  try {
    const db = await getDB()
    const entry = await db.get(STORE, makeKey(table, params))
    if (!entry) return null
    if (Date.now() > entry.expires_at) {
      // Expired — delete and return null
      await db.delete(STORE, entry.key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export async function setCachedRef(table: string, params: object, data: unknown[]): Promise<void> {
  try {
    const db = await getDB()
    const now = Date.now()
    const entry: CacheEntry = {
      key: makeKey(table, params),
      data,
      cached_at: now,
      expires_at: now + TTL_MS,
    }
    await db.put(STORE, entry)
  } catch {
    // Cache write failure is non-fatal — the live query result is still returned
  }
}

export async function getCacheDate(table: string): Promise<Date | null> {
  try {
    const db = await getDB()
    // Find any entry for this table (any params) — take the most recent cached_at
    const allEntries = await db.getAll(STORE)
    const tableEntries = allEntries.filter(e => e.key.startsWith(`${table}:`))
    if (tableEntries.length === 0) return null
    const latest = Math.max(...tableEntries.map(e => e.cached_at))
    return new Date(latest)
  } catch {
    return null
  }
}

export async function purgeExpiredRefCache(): Promise<void> {
  try {
    const db = await getDB()
    const now = Date.now()
    const allEntries = await db.getAll(STORE)
    const expired = allEntries.filter(e => now > e.expires_at)
    await Promise.all(expired.map(e => db.delete(STORE, e.key)))
  } catch {
    // Non-fatal
  }
}
