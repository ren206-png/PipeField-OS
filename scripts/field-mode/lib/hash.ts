import { createHash } from 'crypto'

/** SHA-256 of raw file bytes, hex-encoded. Used as source_file_sha256. */
export function sha256File(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}
