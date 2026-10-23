'use client'
// ============================================================
// ISO Tap-to-Calculate — Snapshot CRUD
// ============================================================
import { IsoCalcSnapshot, IsoCalcSnapshotSchema, getIsoCalcDB } from './snapshot-schema'
import { clearImagesForUser } from './image-store'

// ── Typed quota error ─────────────────────────────────────────

export class QuotaError extends Error {
  readonly kind = 'quota-exceeded' as const
  constructor() {
    super('IndexedDB quota exceeded — free up storage and try again.')
    this.name = 'QuotaError'
  }
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return true
  if (err instanceof Error && err.name === 'QuotaExceededError') return true
  return false
}

// ── Persistent storage (best-effort, one attempt) ─────────────
let persistRequested = false

async function requestPersistOnce(): Promise<void> {
  if (persistRequested) return
  persistRequested = true
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist()
    }
  } catch {
    // Best-effort — not promised to the user
  }
}

// ── CRUD ──────────────────────────────────────────────────────

/**
 * Validate and save a snapshot to IDB.
 * Throws QuotaError on quota exceeded; throws ZodError on invalid schema.
 * Never silently swallows a write failure.
 */
export async function saveSnapshot(snapshot: IsoCalcSnapshot): Promise<IsoCalcSnapshot> {
  const validated = IsoCalcSnapshotSchema.parse(snapshot)
  await requestPersistOnce()
  const db = await getIsoCalcDB()
  try {
    await db.put('iso_calc_snapshots', validated)
  } catch (err) {
    if (isQuotaError(err)) throw new QuotaError()
    throw err
  }
  return validated
}

/**
 * List all snapshots for a user+org, most recent first.
 */
export async function listSnapshots(
  userId: string,
  organizationId: string,
): Promise<IsoCalcSnapshot[]> {
  const db  = await getIsoCalcDB()
  const all = await db.getAllFromIndex('iso_calc_snapshots', 'by-user', userId)
  return all
    .filter(s => s.organizationId === organizationId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Get a single snapshot by ID. Returns null if not found.
 */
export async function getSnapshot(id: string): Promise<IsoCalcSnapshot | null> {
  const db     = await getIsoCalcDB()
  const record = await db.get('iso_calc_snapshots', id)
  return record ?? null
}

/**
 * Delete a snapshot by ID. Noop if not found.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getIsoCalcDB()
  await db.delete('iso_calc_snapshots', id)
}

/**
 * Delete all snapshots for a given user+org.
 */
export async function clearSnapshotsForUser(
  userId: string,
  organizationId: string,
): Promise<void> {
  const db      = await getIsoCalcDB()
  const records = await db.getAllFromIndex('iso_calc_snapshots', 'by-user', userId)
  const toDelete = records.filter(s => s.organizationId === organizationId)
  await Promise.all(toDelete.map(s => db.delete('iso_calc_snapshots', s.id)))
}

/**
 * Must be called on account switch and logout.
 * Clears snapshots and images for the given user+org.
 *
 * NOTE: This is namespace separation, NOT encryption.
 * Records remain in the browser's IDB storage until this function runs.
 * Call it on every logout and account-switch event.
 */
export async function onAccountSwitch(
  userId: string,
  organizationId: string,
): Promise<void> {
  await Promise.all([
    clearSnapshotsForUser(userId, organizationId),
    clearImagesForUser(userId, organizationId),
  ])
}
