'use client'
// ============================================================
// ISO Tap-to-Calculate — Image Blob Store
//
// Images are stored separately from snapshot metadata so that
// large blobs never bloat the JSON records.
// ============================================================
import { IsoCalcImageRecord, getIsoCalcDB } from './snapshot-schema'

export async function saveImage(
  snapshotId: string,
  userId: string,
  organizationId: string,
  blob: Blob,
): Promise<void> {
  const db = await getIsoCalcDB()
  const record: IsoCalcImageRecord = {
    id: snapshotId,
    userId,
    organizationId,
    blob,
    storedAt: new Date().toISOString(),
  }
  await db.put('iso_calc_images', record)
}

export async function getImage(snapshotId: string): Promise<Blob | null> {
  const db     = await getIsoCalcDB()
  const record = await db.get('iso_calc_images', snapshotId)
  return record?.blob ?? null
}

export async function deleteImage(snapshotId: string): Promise<void> {
  const db = await getIsoCalcDB()
  await db.delete('iso_calc_images', snapshotId)
}

export async function clearImagesForUser(
  userId: string,
  organizationId: string,
): Promise<void> {
  const db      = await getIsoCalcDB()
  const records = await db.getAllFromIndex('iso_calc_images', 'by-user', userId)
  const toDelete = records.filter(r => r.organizationId === organizationId)
  await Promise.all(toDelete.map(r => db.delete('iso_calc_images', r.id)))
}
