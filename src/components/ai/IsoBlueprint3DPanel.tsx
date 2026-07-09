'use client'
// ============================================================
// IsoBlueprint3DPanel
//
// Drag-and-drop / click-to-upload panel that sends an ISO
// drawing to /api/ai/iso-blueprint-3d and renders the
// structured 3D spatial breakdown returned by GPT-4o.
// ============================================================
import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react'
import {
  Box,
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  RotateCcw,
  Shield,
  Printer,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

// ── Types ─────────────────────────────────────────────────────
interface PipeRun {
  run_id:          string
  direction:       string
  elevation:       string
  pipe_size:       string
  material:        string
  length_estimate: string
  start_point:     string
  end_point:       string
  notes:           string
}

interface Fitting {
  tag:       string
  type:      string
  size:      string
  location:  string
  elevation: string
}

interface Support {
  tag:      string
  type:     string
  location: string
}

interface Elevations {
  lowest:         string
  highest:        string
  key_elevations: string[]
}

interface Iso3dResult {
  summary:        string
  pipe_runs:      PipeRun[]
  fittings:       Fitting[]
  supports:       Support[]
  elevations:     Elevations
  flow_direction: string
  line_number:    string | null
  concerns:       string[]
  confidence:     'high' | 'medium' | 'low'
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'done' | 'error'

// ── Helpers ───────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  low:    'bg-red-500/15 text-red-400 border border-red-500/30',
}

function isVertical(direction: string) {
  return direction.toLowerCase().includes('vertical')
}

// ── Print stylesheet ──────────────────────────────────────────
const PRINT_STYLE_ID = 'iso-blueprint-print-style'

function usePrintStyle() {
  useEffect(() => {
    if (document.getElementById(PRINT_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    style.media = 'print'
    style.textContent = `
      /* Hide everything except results */
      body { background: #fff !important; color: #111 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

      /* Hide upload zone, nav, sidebar, reset button, export button */
      [data-print-hide],
      nav, aside, header, footer,
      [class*="sidebar"], [class*="nav-"],
      [data-iso-upload-zone],
      [data-iso-reset],
      [data-iso-export] { display: none !important; }

      /* Show only results */
      [data-iso-results] { display: block !important; }

      /* Print header */
      [data-iso-results]::before {
        content: 'ISO Blueprint 3D Analysis — PipeField OS';
        display: block;
        font-size: 18px;
        font-weight: 700;
        color: #111;
        margin-bottom: 4px;
      }
      [data-iso-results]::after {
        content: attr(data-print-date);
        display: block;
        font-size: 12px;
        color: #666;
        margin-bottom: 24px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 12px;
      }

      /* Cards — white background, black border */
      .card,
      [class*="rounded-xl"],
      [class*="rounded-2xl"] {
        background: #fff !important;
        border-color: #ccc !important;
        color: #111 !important;
        box-shadow: none !important;
      }

      /* Text colours */
      [class*="text-surface-50"],
      [class*="text-surface-100"],
      [class*="text-surface-200"],
      [class*="text-surface-300"] { color: #111 !important; }
      [class*="text-surface-400"],
      [class*="text-surface-500"],
      [class*="text-surface-600"] { color: #555 !important; }

      /* Pipe run cards — clean page breaks */
      [data-iso-pipe-run] {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* Table */
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 6px 10px; color: #111 !important; background: #fff !important; }
      th { background: #f5f5f5 !important; font-weight: 600; }

      /* Confidence badge */
      [class*="bg-emerald"], [class*="bg-amber"], [class*="bg-red-5"] {
        background: #eee !important;
        color: #111 !important;
        border-color: #ccc !important;
      }

      /* Violet badges */
      [class*="bg-violet"] { background: #eee !important; color: #333 !important; border-color: #ccc !important; }
    `
    document.head.appendChild(style)
    return () => {
      const el = document.getElementById(PRINT_STYLE_ID)
      if (el) el.remove()
    }
  }, [])
}

// ── Result panel ──────────────────────────────────────────────
function Iso3dResultPanel({
  result,
  onReset,
}: {
  result: Iso3dResult
  onReset: () => void
}) {
  usePrintStyle()
  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div
      className="space-y-4 mt-6"
      data-iso-results
      data-print-date={printDate}
    >

      {/* Export PDF button */}
      <div className="flex justify-end" data-iso-export>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-800/60 px-4 py-2 text-sm font-medium text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      {/* Summary */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-violet-400 shrink-0" />
            <h3 className="text-sm font-semibold text-surface-100">3D Spatial Summary</h3>
          </div>
          <div className="flex items-center gap-2">
            {result.line_number && (
              <span className="text-xs px-2 py-1 rounded-lg bg-surface-700 text-surface-300 font-mono">
                Line: {result.line_number}
              </span>
            )}
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                CONFIDENCE_STYLES[result.confidence] ?? CONFIDENCE_STYLES.low
              }`}
            >
              {result.confidence} confidence
            </span>
          </div>
        </div>
        <p className="text-sm text-surface-300 leading-relaxed">{result.summary}</p>
      </div>

      {/* Pipe Runs */}
      {result.pipe_runs && result.pipe_runs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-700">
            <h3 className="text-sm font-semibold text-surface-100">
              Pipe Runs ({result.pipe_runs.length})
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.pipe_runs.map((run, i) => (
              <div
                key={i}
                data-iso-pipe-run
                className="rounded-xl border border-surface-700 bg-surface-800/40 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {run.run_id}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-surface-400">
                    {isVertical(run.direction)
                      ? <ArrowUp className="w-3 h-3 text-violet-400" />
                      : <ArrowRight className="w-3 h-3 text-violet-400" />
                    }
                    <span>{run.direction}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-md bg-surface-700 text-surface-300">
                    {run.elevation}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-surface-700 text-surface-300 font-mono">
                    {run.pipe_size}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-surface-700 text-surface-400">
                    {run.material}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-surface-400">
                  <span className="text-surface-300 truncate max-w-[120px]">{run.start_point}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <span className="text-surface-300 truncate max-w-[120px]">{run.end_point}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-surface-500">
                  <span>Length:</span>
                  <span className="text-surface-400 font-mono">{run.length_estimate}</span>
                </div>

                {run.notes && (
                  <p className="text-xs text-surface-500 italic leading-relaxed">{run.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fittings table */}
      {result.fittings && result.fittings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-700">
            <h3 className="text-sm font-semibold text-surface-100">
              Fittings ({result.fittings.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-800/60">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Tag</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Size</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Location</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Elevation</th>
                </tr>
              </thead>
              <tbody>
                {result.fittings.map((f, i) => (
                  <tr key={i} className="border-t border-surface-700 hover:bg-surface-800/50 transition-colors">
                    <td className="px-4 py-2.5 text-sm text-surface-300 font-mono">{f.tag}</td>
                    <td className="px-4 py-2.5 text-sm text-surface-200">{f.type}</td>
                    <td className="px-4 py-2.5 text-sm text-surface-400 font-mono">{f.size}</td>
                    <td className="px-4 py-2.5 text-sm text-surface-400">{f.location}</td>
                    <td className="px-4 py-2.5 text-sm text-surface-400">{f.elevation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supports + Elevations row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {result.supports && result.supports.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              Pipe Supports ({result.supports.length})
            </h3>
            <ul className="space-y-2">
              {result.supports.map((s, i) => (
                <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 shrink-0">
                    {s.tag}
                  </span>
                  <span>{s.type} — {s.location}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.elevations && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              Elevations
            </h3>
            <div className="flex gap-4 mb-3">
              <div>
                <p className="text-xs text-surface-500">Lowest</p>
                <p className="text-sm text-surface-200 font-mono">{result.elevations.lowest}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Highest</p>
                <p className="text-sm text-surface-200 font-mono">{result.elevations.highest}</p>
              </div>
            </div>
            {result.elevations.key_elevations && result.elevations.key_elevations.length > 0 && (
              <ul className="space-y-1">
                {result.elevations.key_elevations.map((e, i) => (
                  <li key={i} className="text-xs text-surface-400 flex items-start gap-1.5">
                    <span className="text-violet-400 mt-0.5 shrink-0">·</span>
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Flow direction */}
      {result.flow_direction && (
        <div className="card p-4 flex items-start gap-3">
          <ChevronRight className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">
              Flow Direction
            </p>
            <p className="text-sm text-surface-300 italic leading-relaxed">{result.flow_direction}</p>
          </div>
        </div>
      )}

      {/* Concerns */}
      {result.concerns && result.concerns.length > 0 && (
        <div className="card p-5 border-warning/20 bg-warning/5">
          <h3 className="text-xs font-semibold text-warning/70 uppercase tracking-wide mb-3">
            Concerns ({result.concerns.length})
          </h3>
          <ul className="space-y-1.5">
            {result.concerns.map((c, i) => (
              <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-warning mt-0.5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-surface-700 bg-surface-800/40 p-4">
        <Shield className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
        <p className="text-xs text-surface-500 leading-relaxed">
          <span className="font-semibold text-surface-400">Engineering disclaimer:</span>{' '}
          AI isometric analysis is intended as a review aid only. Always verify pipe runs,
          fittings, and elevations against the original stamped drawings and with a qualified
          engineer before fabrication or installation.
        </p>
      </div>

      {/* Reset */}
      <div className="flex justify-center pt-2" data-iso-reset>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 text-sm text-surface-400 hover:text-violet-300 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Analyse another drawing
        </button>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────
export function IsoBlueprint3DPanel() {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<Iso3dResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptFile = useCallback((file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setErrorMsg('Unsupported file type. Please upload a PNG, JPG, JPEG, or PDF.')
      setUploadState('error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds the 10 MB limit.')
      setUploadState('error')
      return
    }
    setSelectedFile(file)
    setErrorMsg(null)
    setUploadState('idle')
  }, [])

  // Drag events
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setUploadState('dragging')
  }
  const onDragLeave = () => {
    setUploadState(selectedFile ? 'idle' : 'idle')
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) acceptFile(file)
    else setUploadState('idle')
  }
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) acceptFile(file)
  }

  async function handleAnalyse() {
    if (!selectedFile) return
    setUploadState('uploading')
    setResult(null)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await apiFetch('/api/ai/iso-blueprint-3d', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setErrorMsg(json.error ?? 'Analysis failed. Please try again.')
        setUploadState('error')
        return
      }

      const json = await res.json() as { data: Iso3dResult }
      setResult(json.data)
      setUploadState('done')
    } catch {
      setErrorMsg('Could not reach the AI service. Check your connection.')
      setUploadState('error')
    }
  }

  function handleReset() {
    setUploadState('idle')
    setSelectedFile(null)
    setResult(null)
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isDragging  = uploadState === 'dragging'
  const isUploading = uploadState === 'uploading'

  return (
    <div>
      {/* Panel header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Box className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-surface-50">ISO Blueprint 3D</h2>
          <p className="text-xs text-surface-500">
            Upload an ISO drawing to extract a 3D spatial pipe run breakdown
          </p>
        </div>
      </div>

      {/* Upload zone — only show when not done */}
      {uploadState !== 'done' && (
        <div
          data-iso-upload-zone
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={[
            'relative rounded-2xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer select-none',
            isDragging
              ? 'border-violet-500/50 bg-violet-500/5'
              : 'border-surface-600 hover:border-violet-500/40 hover:bg-violet-500/5',
          ].join(' ')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className="hidden"
            onChange={onFileChange}
            disabled={isUploading}
          />

          {isUploading ? (
            /* Uploading state */
            <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-sm font-medium text-surface-200">Analysing ISO drawing…</p>
              <p className="text-xs text-surface-500">This may take 15–30 seconds</p>
            </div>
          ) : isDragging ? (
            /* Dragging state */
            <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
              <Upload className="w-8 h-8 text-violet-400" />
              <p className="text-sm font-semibold text-violet-300">Drop to analyse</p>
            </div>
          ) : selectedFile ? (
            /* File selected, ready to analyse */
            <div
              className="flex flex-col items-center gap-4 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                <Box className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-surface-100">{selectedFile.name}</p>
                <p className="text-xs text-surface-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAnalyse}
                  className="btn-primary flex items-center gap-2"
                >
                  <Box className="w-4 h-4" />
                  Analyse
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            /* Idle / default state */
            <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
              <Upload className="w-8 h-8 text-surface-500" />
              <div>
                <p className="text-sm font-medium text-surface-300">
                  Drag &amp; drop your ISO drawing here
                </p>
                <p className="text-xs text-surface-500 mt-0.5">or click to browse</p>
              </div>
              <p className="text-xs text-surface-600">
                Supports PNG, JPG, JPEG · PDF (first page) · Max 10 MB
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {(uploadState === 'error' || errorMsg) && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-red-400/70 hover:text-red-300 shrink-0 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {result && uploadState === 'done' && (
        <Iso3dResultPanel result={result} onReset={handleReset} />
      )}
    </div>
  )
}
