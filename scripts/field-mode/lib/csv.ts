// ============================================================
// Minimal dependency-free CSV parser.
// Handles quoted fields, embedded commas, embedded newlines, and
// escaped quotes ("") per RFC 4180. No external dependency needed
// (package.json has no csv-parse; only csv-stringify for output).
//
// This is read-only parsing of source files under /data/sources/.
// It never mutates, reformats, or "corrects" a value — it returns
// exactly what is in the file, as strings, one object per row keyed
// by the header row.
// ============================================================

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
  /** Raw rows (array form), same order as `rows`. */
  rawRows: string[][]
}

export function parseCsv(text: string): ParsedCsv {
  // Normalize line endings but do not alter content.
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let i = 0
  const n = src.length

  const pushField = () => { record.push(field); field = '' }
  const pushRecord = () => {
    pushField()
    // Skip fully-empty trailing records (blank lines).
    if (!(record.length === 1 && record[0] === '')) records.push(record)
    record = []
  }

  while (i < n) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') { inQuotes = true; i += 1; continue }
    if (ch === ',') { pushField(); i += 1; continue }
    if (ch === '\n') { pushRecord(); i += 1; continue }
    field += ch
    i += 1
  }
  // Final field/record (file may or may not end with newline).
  if (field.length > 0 || record.length > 0) pushRecord()

  if (records.length === 0) return { headers: [], rows: [], rawRows: [] }

  const headers = records[0].map((h) => h.trim())
  const rawRows = records.slice(1)
  const rows = rawRows.map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : '' })
    return obj
  })

  return { headers, rows, rawRows }
}
