// ============================================================
// CSV Export Utility
// Converts any array of objects to a downloadable CSV file.
// Runs entirely in the browser — no server needed.
// ============================================================

/**
 * Convert an array of objects to a CSV string and trigger download.
 * @param rows   Array of flat objects (values must be string/number/boolean/null)
 * @param filename  e.g. "weld-log-2024-01-15.csv"
 */
export function downloadCSV(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    // Wrap in quotes if it contains a comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Format a date string as YYYY-MM-DD for filenames */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
