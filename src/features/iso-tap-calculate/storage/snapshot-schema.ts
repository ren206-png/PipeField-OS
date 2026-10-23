'use client'
// ============================================================
// ISO Tap-to-Calculate — Snapshot + Image IDB Schema
//
// Extends 'pipefield-offline' to version 5:
//   v3 → v4: adds iso_calc_snapshots store
//   v4 → v5: adds iso_calc_images store
//
// Follows the exact openDB / DBSchema / upgrade pattern from
// src/lib/offline-queue.ts.
// ============================================================
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const IsoCalcSnapshotSchema = z.object({
  id:            z.string().uuid(),
  schemaVersion: z.literal(1),
  createdAt:     z.string().datetime(),
  updatedAt:     z.string().datetime(),

  // Tenancy (namespace separation — not encryption)
  userId:         z.string(),
  organizationId: z.string(),

  // Drawing context
  drawingLabel:    z.string().default('unspecified'),
  drawingRevision: z.string().optional(),

  // Image reference (immutable; absent for manual-entry-only snapshots)
  imageRef: z.object({
    storedAt:        z.string().datetime(),
    originalSizeBytes: z.number().int().positive(),
    originalWidthPx:   z.number().int().positive(),
    originalHeightPx:  z.number().int().positive(),
    rotationApplied:   z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    exifStripped:      z.literal(true),
  }).optional(),

  // Raw OCR output (never modified after save)
  ocrRawText:    z.string().optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),

  // Confirmed inputs
  mode: z.enum(['mode-a', 'mode-b']),
  inputs: z.object({
    rise:     z.object({ valueMm: z.number(), unit: z.string(), rawText: z.string(), confirmedAt: z.string().datetime() }),
    roll:     z.object({ valueMm: z.number(), unit: z.string(), rawText: z.string(), confirmedAt: z.string().datetime() }),
    run:      z.object({ valueMm: z.number(), unit: z.string(), rawText: z.string(), confirmedAt: z.string().datetime() }).optional(),
    angleDeg: z.number().optional(),
  }),
  inputsConfirmedAt: z.string().datetime(),

  // Geometry (unrounded)
  geometry: z.object({
    trueOffsetMm: z.number(),
    travelMm:     z.number(),
    thetaDeg:     z.number().optional(),
    runMm:        z.number().optional(),
  }),

  // Connection strategy
  strategy: z.discriminatedUnion('type', [
    z.object({ type: z.literal('geometry-only') }),
    z.object({
      type:    z.literal('butt-weld'),
      fittingA: z.object({ nominalSizeNps: z.string(), angleDeg: z.number(), deductionMm: z.number(), verified: z.boolean(), sourceDoc: z.string() }),
      fittingB: z.object({ nominalSizeNps: z.string(), angleDeg: z.number(), deductionMm: z.number(), verified: z.boolean(), sourceDoc: z.string() }),
      gapAMm:      z.number(),
      gapBMm:      z.number(),
      cutLengthMm: z.number(),
    }),
    z.object({
      type:     z.literal('threaded-npt'),
      fitting1: z.object({ threadFamily: z.literal('NPT'), nominalSizeNps: z.string(), faceDistanceMm: z.number(), standard: z.string() }),
      fitting2: z.object({ threadFamily: z.literal('NPT'), nominalSizeNps: z.string(), faceDistanceMm: z.number(), standard: z.string() }),
      engagement1: z.object({ valueMm: z.number(), rangeMinMm: z.number(), rangeMaxMm: z.number(), sourceDescription: z.string() }),
      engagement2: z.object({ valueMm: z.number(), rangeMinMm: z.number(), rangeMaxMm: z.number(), sourceDescription: z.string() }),
      cutLengthMm:      z.number().nullable(),
      cutLengthRangeMm: z.tuple([z.number(), z.number()]),
    }),
  ]),

  formulaVersion: z.literal('1.0.0'),
  displayUnit:    z.enum(['mm', 'in', 'both']),
  warnings:       z.array(z.string()),
})

export type IsoCalcSnapshot = z.infer<typeof IsoCalcSnapshotSchema>

// ---------------------------------------------------------------------------
// Image record (stored separately from snapshot metadata)
// ---------------------------------------------------------------------------

export interface IsoCalcImageRecord {
  id:             string  // = snapshotId
  userId:         string
  organizationId: string
  blob:           Blob
  storedAt:       string
}

// ---------------------------------------------------------------------------
// DBSchema — extends the existing PipeField stores
// ---------------------------------------------------------------------------

interface PipeFieldExtendedDB extends DBSchema {
  // ── Existing stores (v1–v3) — must not be touched ──────────
  weld_queue: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
  daily_report_queue: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
  spool_queue: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
  field_weld_queue: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
  // ── New stores ──────────────────────────────────────────────
  iso_calc_snapshots: {
    key: string
    value: IsoCalcSnapshot
    indexes: { 'by-user': string; 'by-org': string; 'by-created': string }
  }
  iso_calc_images: {
    key: string
    value: IsoCalcImageRecord
    indexes: { 'by-user': string; 'by-org': string }
  }
}

let dbPromise: Promise<IDBPDatabase<PipeFieldExtendedDB>> | null = null

export function getIsoCalcDB(): Promise<IDBPDatabase<PipeFieldExtendedDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PipeFieldExtendedDB>('pipefield-offline', 5, {
      upgrade(db, oldVersion) {
        // v1–v3 upgrades handled by offline-queue.ts when it runs first.
        // We only need to ensure the existing stores exist if this DB is opened
        // fresh (e.g. in tests) before offline-queue.ts has run.
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
        if (oldVersion < 3) {
          const fw = db.createObjectStore('field_weld_queue', { keyPath: 'local_id' })
          fw.createIndex('by-sync-status', 'sync_status')
          fw.createIndex('by-project', 'project_id')
        }
        // v3 → v4: ISO calc snapshots
        if (oldVersion < 4) {
          const snap = db.createObjectStore('iso_calc_snapshots', { keyPath: 'id' })
          snap.createIndex('by-user',    'userId')
          snap.createIndex('by-org',     'organizationId')
          snap.createIndex('by-created', 'createdAt')
        }
        // v4 → v5: ISO calc image blobs (separate from snapshot metadata)
        if (oldVersion < 5) {
          const img = db.createObjectStore('iso_calc_images', { keyPath: 'id' })
          img.createIndex('by-user', 'userId')
          img.createIndex('by-org',  'organizationId')
        }
      },
    })
  }
  return dbPromise
}

/** Reset the cached DB promise — for tests only. */
export function _resetDbPromise(): void {
  dbPromise = null
}
