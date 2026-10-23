// ============================================================
// snapshot-store tests — uses fake-indexeddb to avoid real browser IDB
// ============================================================
// fake-indexeddb/auto sets all IDB globals (IDBRequest, IDBTransaction, etc.)
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { IsoCalcSnapshot } from '../snapshot-schema'
import {
  saveSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  clearSnapshotsForUser,
  onAccountSwitch,
  QuotaError,
} from '../snapshot-store'
import { getImage, saveImage } from '../image-store'
import { _resetDbPromise } from '../snapshot-schema'

// Replace indexedDB with a fresh factory per test for isolation.
// fake-indexeddb/auto already wired all other IDB globals.
beforeEach(() => {
  global.indexedDB = new IDBFactory()
  _resetDbPromise()
})

// ── Fixtures ──────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<IsoCalcSnapshot> = {}): IsoCalcSnapshot {
  const base: IsoCalcSnapshot = {
    id:             crypto.randomUUID(),
    schemaVersion:  1,
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
    userId:         'user-1',
    organizationId: 'org-1',
    drawingLabel:   'unspecified',
    mode:           'mode-b',
    inputs: {
      rise: { valueMm: 300, unit: 'mm', rawText: '300 mm', confirmedAt: new Date().toISOString() },
      roll: { valueMm: 400, unit: 'mm', rawText: '400 mm', confirmedAt: new Date().toISOString() },
      angleDeg: 45,
    },
    inputsConfirmedAt: new Date().toISOString(),
    geometry: {
      trueOffsetMm: 500,
      travelMm:     707.1067811865476,
      runMm:        500,
    },
    strategy:       { type: 'geometry-only' },
    formulaVersion: '1.0.0',
    displayUnit:    'mm',
    warnings:       [],
  }
  return { ...base, ...overrides }
}

// ── Test 1: save + get ────────────────────────────────────────

test('save a valid snapshot and retrieve it by id', async () => {
  const snap = makeSnapshot()
  await saveSnapshot(snap)
  const retrieved = await getSnapshot(snap.id)
  expect(retrieved).not.toBeNull()
  expect(retrieved!.id).toBe(snap.id)
  expect(retrieved!.geometry.travelMm).toBe(707.1067811865476)
})

// ── Test 2: invalid schema throws before write ────────────────

test('save with invalid schema throws ZodError, nothing written', async () => {
  const bad = { ...makeSnapshot(), schemaVersion: 99 }  // invalid literal
  await expect(saveSnapshot(bad as IsoCalcSnapshot)).rejects.toThrow()
  const all = await listSnapshots('user-1', 'org-1')
  expect(all).toHaveLength(0)
})

// ── Test 3: listSnapshots sorted desc, filtered by userId+org ─

test('listSnapshots returns sorted by createdAt desc, filtered by user+org', async () => {
  const older = makeSnapshot({ id: crypto.randomUUID(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
  const newer = makeSnapshot({ id: crypto.randomUUID(), createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' })
  const otherUser = makeSnapshot({ id: crypto.randomUUID(), userId: 'user-2', organizationId: 'org-2' })

  await saveSnapshot(older)
  await saveSnapshot(newer)
  await saveSnapshot(otherUser)

  const list = await listSnapshots('user-1', 'org-1')
  expect(list).toHaveLength(2)
  expect(list[0].id).toBe(newer.id)  // most recent first
  expect(list[1].id).toBe(older.id)
})

// ── Test 4: deleteSnapshot removes it ────────────────────────

test('deleteSnapshot removes the record', async () => {
  const snap = makeSnapshot()
  await saveSnapshot(snap)
  await deleteSnapshot(snap.id)
  const result = await getSnapshot(snap.id)
  expect(result).toBeNull()
})

// ── Test 5: clearSnapshotsForUser removes only that user's ────

test('clearSnapshotsForUser removes only matching user+org records', async () => {
  const u1 = makeSnapshot({ id: crypto.randomUUID(), userId: 'user-1', organizationId: 'org-1' })
  const u2 = makeSnapshot({ id: crypto.randomUUID(), userId: 'user-2', organizationId: 'org-2' })
  await saveSnapshot(u1)
  await saveSnapshot(u2)

  await clearSnapshotsForUser('user-1', 'org-1')

  expect(await getSnapshot(u1.id)).toBeNull()
  expect(await getSnapshot(u2.id)).not.toBeNull()
})

// ── Test 6: QuotaExceededError → QuotaError ──────────────────

test('QuotaExceededError from IDB is wrapped as QuotaError', async () => {
  const { getIsoCalcDB } = require('../snapshot-schema')
  const db = await getIsoCalcDB()

  // Monkey-patch the put method to throw a QuotaExceededError
  const original = db.put.bind(db)
  db.put = async (store: string) => {
    if (store === 'iso_calc_snapshots') {
      const err = new DOMException('Quota exceeded', 'QuotaExceededError')
      throw err
    }
    return original(store)
  }

  const snap = makeSnapshot()
  await expect(saveSnapshot(snap)).rejects.toBeInstanceOf(QuotaError)

  // Restore
  db.put = original
})

// ── Test 7: strategy type isolation ──────────────────────────

test('threaded-npt strategy has no gapAMm/gapBMm fields', () => {
  const threaded: IsoCalcSnapshot = makeSnapshot({
    strategy: {
      type:     'threaded-npt',
      fitting1: { threadFamily: 'NPT', nominalSizeNps: '1', faceDistanceMm: 40, standard: 'ASME B16.11' },
      fitting2: { threadFamily: 'NPT', nominalSizeNps: '1', faceDistanceMm: 45, standard: 'ASME B16.11' },
      engagement1: { valueMm: 12, rangeMinMm: 11, rangeMaxMm: 13, sourceDescription: 'Anvil catalog' },
      engagement2: { valueMm: 14, rangeMinMm: 13, rangeMaxMm: 15, sourceDescription: 'Anvil catalog' },
      cutLengthMm:      941,
      cutLengthRangeMm: [939, 943],
    },
  })
  expect('gapAMm' in threaded.strategy).toBe(false)
  expect('gapBMm' in threaded.strategy).toBe(false)
})

test('butt-weld strategy has no cutLengthRangeMm field', () => {
  const bw: IsoCalcSnapshot = makeSnapshot({
    strategy: {
      type:     'butt-weld',
      fittingA: { nominalSizeNps: '4', angleDeg: 90, deductionMm: 100, verified: true, sourceDoc: 'B16.9' },
      fittingB: { nominalSizeNps: '4', angleDeg: 90, deductionMm: 120, verified: true, sourceDoc: 'B16.9' },
      gapAMm:      3,
      gapBMm:      3,
      cutLengthMm: 774,
    },
  })
  expect('cutLengthRangeMm' in bw.strategy).toBe(false)
})

// ── Test 8: onAccountSwitch clears only that user's data ──────

test('onAccountSwitch clears snapshots and images for that user+org only', async () => {
  const u1 = makeSnapshot({ id: crypto.randomUUID(), userId: 'user-1', organizationId: 'org-1' })
  const u2 = makeSnapshot({ id: crypto.randomUUID(), userId: 'user-2', organizationId: 'org-2' })
  await saveSnapshot(u1)
  await saveSnapshot(u2)

  // Save images for both
  await saveImage(u1.id, 'user-1', 'org-1', new Blob(['img1'], { type: 'image/jpeg' }))
  await saveImage(u2.id, 'user-2', 'org-2', new Blob(['img2'], { type: 'image/jpeg' }))

  await onAccountSwitch('user-1', 'org-1')

  expect(await getSnapshot(u1.id)).toBeNull()
  expect(await getImage(u1.id)).toBeNull()

  expect(await getSnapshot(u2.id)).not.toBeNull()
  expect(await getImage(u2.id)).not.toBeNull()
})
