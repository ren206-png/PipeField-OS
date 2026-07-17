// Strip EXIF metadata from JPEG/PNG/WebP before AI processing.
// JPEG: remove all APP1 (0xFFE1) segments that contain Exif data.
// PNG/WebP: pass through unchanged (EXIF in PNG is rare; WebP stripping
// would require full re-encode — acceptable to skip for now).
// Returns a new Buffer with EXIF removed (or the original if not JPEG).

export function stripExif(buffer: Buffer, mimeType: string): Buffer {
  if (mimeType !== 'image/jpeg') return buffer

  const bytes = new Uint8Array(buffer)
  // JPEG must start with FF D8
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return buffer

  const output: number[] = [0xFF, 0xD8]
  let i = 2
  while (i < bytes.length) {
    if (bytes[i] !== 0xFF) break
    const marker = bytes[i + 1]
    // APP1 = 0xE1 — may contain Exif or XMP; skip entirely
    const segLen = (bytes[i + 2] << 8) | bytes[i + 3]
    if (marker === 0xE1) {
      i += 2 + segLen  // skip this segment
      continue
    }
    // SOS = 0xDA — start of scan, rest is image data
    if (marker === 0xDA) {
      const tail = bytes.slice(i)
      for (let j = 0; j < tail.length; j++) output.push(tail[j])
      break
    }
    const seg = bytes.slice(i, i + 2 + segLen)
    for (let j = 0; j < seg.length; j++) output.push(seg[j])
    i += 2 + segLen
  }
  return Buffer.from(output)
}
