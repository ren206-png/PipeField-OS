'use client'
// ============================================================
// ImportWeldsModal — CSV bulk import for welds
//
// CSV format (first row = headers, rest = data):
//   weld_id_number, project_id, welder_name, welder_stamp, weld_date, notes
//
// project_id must be a valid UUID from the org's project list.
// Users can download a template pre-filled with their project IDs.
// ============================================================
import { useState, useRef, useCallback } from 'react'
import { X, Upload, Download, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'

interface ParsedRow {
  weld_id_number: string
  project_id:     string
  welder_name:    string
  welder_stamp:   string
  weld_date:      string
  notes:          string
  _row:           number
  _error?:        string
}

interface ImportResult {
  imported:        number
  skipped:         number
  skipped_details: { row: number; reason: string }[]
}

interface Props {
  onClose:   () => void
  onSuccess: () => void
}

const HEADERS = ['weld_id_number', 'project_id', 'welder_name', 'welder_stamp', 'weld_date', 'notes']

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '').trim()))
    .filter(row => row.some(c => c !== ''))
}

export function ImportWeldsModal({ onClose, onSuccess }: Props) {
  const { data: projects = [] } = useProjects()

  const [rows,    setRows]    = useState<ParsedRow[] | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Download template ─────────────────────────────────────
  function downloadTemplate() {
    const headerRow   = HEADERS.join(',')
    const exampleRows = projects.slice(0, 3).map((p, i) =>
      `W-${String(i + 1).padStart(3, '0')},${p.id},John Smith,JS42,${new Date().toISOString().slice(0, 10)},`
    )
    if (exampleRows.length === 0) {
      exampleRows.push(`W-001,YOUR_PROJECT_UUID_HERE,John Smith,JS42,${new Date().toISOString().slice(0, 10)},`)
    }
    const csv  = [headerRow, ...exampleRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'weld-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Parse uploaded CSV ────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setError(null)
    setRows(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const all  = parseCSV(text)
      if (all.length < 2) {
        setError('File is empty or has no data rows.')
        return
      }

      // Normalise headers
      const header = all[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
      const data   = all.slice(1)

      const idxOf = (name: string) => header.indexOf(name)
      const iWeld    = idxOf('weld_id_number')
      const iProject = idxOf('project_id')
      const iWelderN = idxOf('welder_name')
      const iWelderS = idxOf('welder_stamp')
      const iDate    = idxOf('weld_date')
      const iNotes   = idxOf('notes')

      if (iWeld === -1 || iProject === -1) {
        setError('CSV must have "weld_id_number" and "project_id" columns.')
        return
      }

      const validProjectIds = new Set(projects.map(p => p.id))

      const parsed: ParsedRow[] = data.map((row, i) => {
        const weldId    = row[iWeld]    ?? ''
        const projectId = row[iProject] ?? ''
        let   rowError: string | undefined

        if (!weldId)                               rowError = 'Missing weld_id_number'
        else if (!projectId)                       rowError = 'Missing project_id'
        else if (!validProjectIds.has(projectId))  rowError = `Unknown project_id: ${projectId}`

        return {
          weld_id_number: weldId,
          project_id:     projectId,
          welder_name:    iWelderN >= 0 ? (row[iWelderN] ?? '') : '',
          welder_stamp:   iWelderS >= 0 ? (row[iWelderS] ?? '') : '',
          weld_date:      iDate    >= 0 ? (row[iDate]    ?? '') : '',
          notes:          iNotes   >= 0 ? (row[iNotes]   ?? '') : '',
          _row:           i + 2,
          _error:         rowError,
        }
      })

      setRows(parsed)
    }
    reader.readAsText(file)
  }, [projects])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Submit ────────────────────────────────────────────────
  async function handleImport() {
    if (!rows) return
    const validRows = rows.filter(r => !r._error)
    if (validRows.length === 0) {
      setError('No valid rows to import.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/welds/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          rows: validRows.map(r => ({
            weld_id_number: r.weld_id_number,
            project_id:     r.project_id,
            welder_name:    r.welder_name  || null,
            welder_stamp:   r.welder_stamp || null,
            weld_date:      r.weld_date    || null,
            notes:          r.notes        || null,
          })),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Import failed')
      setResult(body as ImportResult)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const validCount   = rows?.filter(r => !r._error).length ?? 0
  const invalidCount = rows?.filter(r =>  r._error).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-surface-50">Bulk Import Welds</h2>
            <p className="text-sm text-surface-500 mt-0.5">Upload a CSV to create multiple welds at once</p>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Template download */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-brand-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-surface-100">Download CSV Template</p>
                <p className="text-xs text-surface-500">Pre-filled with your project IDs</p>
              </div>
            </div>
            <button onClick={downloadTemplate} className="btn-ghost flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              Template
            </button>
          </div>

          {/* Project ID reference */}
          {projects.length > 0 && (
            <div className="p-3 rounded-lg bg-surface-800 border border-surface-700">
              <p className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wide">Your Project IDs</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {projects.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-brand-400 select-all">{p.id}</span>
                    <span className="text-surface-500">— {p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone */}
          {!result && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-surface-600 rounded-xl p-8 text-center hover:border-brand-500/50 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-surface-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-surface-300">Drop your CSV here or click to browse</p>
              <p className="text-xs text-surface-500 mt-1">Max 500 rows · .csv files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview table */}
          {rows && !result && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-sm font-medium text-surface-200">
                  {rows.length} row{rows.length !== 1 ? 's' : ''} parsed
                </p>
                {validCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 font-semibold">
                    {validCount} valid
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 font-semibold">
                    {invalidCount} error{invalidCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-surface-700 overflow-hidden">
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-800 sticky top-0">
                      <tr>
                        {['#', 'Weld ID', 'Project', 'Welder', 'Stamp', 'Date', 'Status'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-surface-400 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800">
                      {rows.map(row => {
                        const project = projects.find(p => p.id === row.project_id)
                        return (
                          <tr key={row._row} className={row._error ? 'bg-red-500/5' : ''}>
                            <td className="px-3 py-2 text-surface-500">{row._row}</td>
                            <td className="px-3 py-2 font-mono text-surface-200 whitespace-nowrap">{row.weld_id_number || '—'}</td>
                            <td className="px-3 py-2 text-surface-300 max-w-[140px] truncate">{project?.name ?? row.project_id.slice(0, 8) + '…'}</td>
                            <td className="px-3 py-2 text-surface-400 whitespace-nowrap">{row.welder_name || '—'}</td>
                            <td className="px-3 py-2 font-mono text-surface-400">{row.welder_stamp || '—'}</td>
                            <td className="px-3 py-2 text-surface-400 whitespace-nowrap">{row.weld_date || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row._error
                                ? <span className="text-red-400 text-xs">{row._error}</span>
                                : <span className="text-green-400 text-xs">✓ Ready</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Import complete</p>
                  <p className="text-sm text-green-400/80">
                    {result.imported} weld{result.imported !== 1 ? 's' : ''} imported
                    {result.skipped > 0 ? `, ${result.skipped} skipped (duplicates)` : ''}
                  </p>
                </div>
              </div>
              {result.skipped_details.length > 0 && (
                <div className="p-3 rounded-lg bg-surface-800 border border-surface-700 text-xs space-y-1">
                  <p className="font-semibold text-surface-400 mb-2">Skipped rows:</p>
                  {result.skipped_details.map(s => (
                    <p key={s.row} className="text-surface-500">Row {s.row}: {s.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-surface-700 flex-shrink-0">
          {result
            ? <button onClick={onClose} className="btn-primary">Done</button>
            : (
              <>
                <button onClick={onClose} disabled={loading} className="btn-ghost text-sm">Cancel</button>
                <button
                  onClick={handleImport}
                  disabled={!rows || validCount === 0 || loading}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                    : <><Upload className="w-4 h-4" /> Import {validCount > 0 ? `${validCount} Weld${validCount !== 1 ? 's' : ''}` : ''}</>
                  }
                </button>
              </>
            )
          }
        </div>
      </div>
    </div>
  )
}
