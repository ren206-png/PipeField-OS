'use client'
// ============================================================
// /intelligence/drawing-analysis — AI Drawing Analysis
//
// Accepts a public URL to an engineering drawing (isometric,
// P&ID, GA, detail) and returns a structured AI analysis:
// components, dimensions, notes, and concerns.
// ============================================================
import { useState, FormEvent } from 'react'
import {
  Layers,
  Send,
  Loader2,
  AlertTriangle,
  Shield,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useProjects } from '@/hooks/useProjects'

// ── Types ─────────────────────────────────────────────────────
type DrawingType = 'isometric' | 'pnid' | 'general_arrangement' | 'detail'

interface DrawingComponent {
  type:        string
  description: string
  tag:         string | null
  size:        string | null
}

interface AnalysisResult {
  analysis:    string
  components:  DrawingComponent[]
  dimensions:  string[]
  notes:       string[]
  concerns:    string[]
  sources?:    Array<{ title: string; document_type: string; public_url: string | null; similarity: number }>
}

// ── Drawing type labels ────────────────────────────────────────
const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  isometric:           'Isometric (ISO)',
  pnid:                'P&ID (Process & Instrumentation)',
  general_arrangement: 'General Arrangement (GA)',
  detail:              'Detail Drawing',
}

// ── Component row ──────────────────────────────────────────────
function ComponentRow({ comp }: { comp: DrawingComponent }) {
  return (
    <tr className="border-t border-surface-700 hover:bg-surface-800/50 transition-colors">
      <td className="px-4 py-2.5 text-sm text-surface-200 font-medium">{comp.type}</td>
      <td className="px-4 py-2.5 text-sm text-surface-300">{comp.description}</td>
      <td className="px-4 py-2.5 text-sm text-surface-400 font-mono">{comp.tag ?? '—'}</td>
      <td className="px-4 py-2.5 text-sm text-surface-400">{comp.size ?? '—'}</td>
    </tr>
  )
}

// ── Knowledge sources collapsible ─────────────────────────────
function KnowledgeSources({
  sources,
}: {
  sources: NonNullable<AnalysisResult['sources']>
}) {
  const [open, setOpen] = useState(false)
  if (!sources.length) return null

  return (
    <div className="card mt-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors"
      >
        <span>Knowledge sources referenced ({sources.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {sources.map((s, i) => {
            const pill = (
              <span
                key={i}
                className="text-xs px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 flex items-center gap-1.5 transition-colors"
              >
                <span className="truncate max-w-[200px]">{s.title}</span>
                <span className="text-surface-500 shrink-0">{Math.round(s.similarity * 100)}%</span>
              </span>
            )
            return s.public_url ? (
              <a key={i} href={s.public_url} target="_blank" rel="noopener noreferrer">
                {pill}
              </a>
            ) : (
              <span key={i}>{pill}</span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Results panel ──────────────────────────────────────────────
function ResultPanel({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4 mt-6">
      {/* Analysis narrative */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
          <h2 className="text-sm font-semibold text-surface-100">Analysis</h2>
        </div>
        <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">{result.analysis}</p>
      </div>

      {/* Components table */}
      {result.components.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-700">
            <h2 className="text-sm font-semibold text-surface-100">
              Components identified ({result.components.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-800/60">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Tag</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide">Size</th>
                </tr>
              </thead>
              <tbody>
                {result.components.map((c, i) => (
                  <ComponentRow key={i} comp={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dimensions, notes, concerns — 3-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {result.dimensions.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              Dimensions
            </h3>
            <ul className="space-y-1.5">
              {result.dimensions.map((d, i) => (
                <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                  <span className="text-teal-400 mt-0.5 shrink-0">·</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.notes.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              Notes
            </h3>
            <ul className="space-y-1.5">
              {result.notes.map((n, i) => (
                <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5 shrink-0">·</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.concerns.length > 0 && (
          <div className="card p-5 border-warning/20 bg-warning/5">
            <h3 className="text-xs font-semibold text-warning/70 uppercase tracking-wide mb-3">
              Concerns
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
      </div>

      {/* Knowledge sources */}
      {result.sources && result.sources.length > 0 && (
        <KnowledgeSources sources={result.sources} />
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-surface-700 bg-surface-800/40 p-4">
        <Shield className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
        <p className="text-xs text-surface-500 leading-relaxed">
          <span className="font-semibold text-surface-400">Engineering disclaimer:</span>{' '}
          AI drawing analysis is intended as a review aid only. Always verify dimensions,
          material specifications, and safety-critical details against the original stamped
          drawings and with a qualified engineer before fabrication or installation.
        </p>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
        <div className="flex items-start gap-3">
          <Layers className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-teal-300">What can Drawing Analysis do?</p>
            <p className="text-xs text-surface-400 mt-1 leading-relaxed">
              Paste any publicly accessible drawing URL and get a structured AI breakdown of
              components, dimensions, annotations, and potential issues — in seconds.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            type: 'Isometric (ISO)',
            example: 'Extract pipe schedule, fittings list, weld symbols, and support requirements.',
          },
          {
            type: 'P&ID',
            example: 'Identify instrument tags, control valves, line numbers, and process streams.',
          },
          {
            type: 'General Arrangement',
            example: 'Capture overall dimensions, equipment layout, and access clearances.',
          },
          {
            type: 'Detail Drawing',
            example: 'Pull weld joint details, surface finish notes, and critical tolerances.',
          },
        ].map(item => (
          <div
            key={item.type}
            className="rounded-xl border border-surface-700 bg-surface-800/40 p-4 space-y-1.5"
          >
            <p className="text-xs font-semibold text-teal-400">{item.type}</p>
            <p className="text-xs text-surface-400 leading-relaxed">{item.example}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function DrawingAnalysisPage() {
  const { data: projects = [] } = useProjects()

  // Form state
  const [drawingUrl,    setDrawingUrl   ] = useState('')
  const [drawingType,   setDrawingType  ] = useState<DrawingType>('isometric')
  const [drawingNumber, setDrawingNumber] = useState('')
  const [revision,      setRevision     ] = useState('')
  const [query,         setQuery        ] = useState('')
  const [projectId,     setProjectId    ] = useState('')

  // Async state
  const [isPending,  setIsPending ] = useState(false)
  const [result,     setResult    ] = useState<AnalysisResult | null>(null)
  const [error,      setError     ] = useState<string | null>(null)
  const [engineOff,  setEngineOff ] = useState(false)
  const [tierBlocked, setTierBlocked] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const url = drawingUrl.trim()
    if (!url || isPending) return

    setIsPending(true)
    setResult(null)
    setError(null)
    setEngineOff(false)
    setTierBlocked(false)

    try {
      const body: Record<string, string> = {
        drawing_url:  url,
        drawing_type: drawingType,
      }
      if (drawingNumber.trim()) body.drawing_number = drawingNumber.trim()
      if (revision.trim())      body.revision        = revision.trim()
      if (query.trim())         body.query           = query.trim()
      if (projectId)            body.project_id      = projectId

      const res = await apiFetch('/api/ai/drawing-analysis', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (res.status === 402) {
        setTierBlocked(true)
        return
      }
      if (res.status === 503) {
        setEngineOff(true)
        return
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }

      const json = await res.json() as { data: AnalysisResult }
      setResult(json.data)
    } catch {
      setError('Could not reach the AI service. Check your connection and try again.')
    } finally {
      setIsPending(false)
    }
  }

  // ── Blocked / engine-off states ────────────────────────────
  if (tierBlocked) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6 text-teal-400" />
        </div>
        <p className="text-surface-200 font-semibold">Professional Plan Required</p>
        <p className="text-surface-400 text-sm leading-relaxed">
          Drawing Analysis requires a Professional plan or higher. Upgrade your subscription
          to unlock AI-powered drawing review.
        </p>
        <button
          type="button"
          onClick={() => setTierBlocked(false)}
          className="text-xs text-surface-500 hover:text-surface-300 underline transition-colors mt-2"
        >
          Go back
        </button>
      </div>
    )
  }

  if (engineOff) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-warning mx-auto" />
        <p className="text-surface-300 font-medium">Drawing Analysis engine is not available.</p>
        <p className="text-surface-500 text-sm">Contact your administrator to enable this feature.</p>
        <button
          type="button"
          onClick={() => setEngineOff(false)}
          className="text-xs text-surface-500 hover:text-surface-300 underline transition-colors mt-2"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">

      {/* Page header */}
      <div className="flex items-center gap-3 pb-5 border-b border-surface-800 mb-6">
        <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
          <Layers className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-surface-50">Drawing Analysis</h1>
          <p className="text-xs text-surface-500">
            AI-powered review of isometrics, P&IDs, GA drawings, and details
          </p>
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">

        {/* Drawing URL */}
        <div className="space-y-1.5">
          <label htmlFor="drawing-url" className="label">
            Drawing URL <span className="text-red-400">*</span>
          </label>
          <input
            id="drawing-url"
            type="url"
            value={drawingUrl}
            onChange={e => setDrawingUrl(e.target.value)}
            placeholder="https://example.com/drawings/ISO-001.pdf"
            required
            disabled={isPending}
            className="input w-full"
          />
          <p className="text-xs text-surface-500">
            Must be a publicly accessible URL (PDF, PNG, JPG, or SVG).
          </p>
        </div>

        {/* Drawing type + Project scope */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="drawing-type" className="label">Drawing type</label>
            <select
              id="drawing-type"
              value={drawingType}
              onChange={e => setDrawingType(e.target.value as DrawingType)}
              disabled={isPending}
              className="input w-full"
            >
              {(Object.entries(DRAWING_TYPE_LABELS) as [DrawingType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {projects.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="project-scope" className="label">Project scope <span className="text-surface-500">(optional)</span></label>
              <select
                id="project-scope"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={isPending}
                className="input w-full"
              >
                <option value="">No project filter</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Drawing number + Revision */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="drawing-number" className="label">
              Drawing number <span className="text-surface-500">(optional)</span>
            </label>
            <input
              id="drawing-number"
              type="text"
              value={drawingNumber}
              onChange={e => setDrawingNumber(e.target.value)}
              placeholder="e.g. ISO-P-2401-001"
              disabled={isPending}
              className="input w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="revision" className="label">
              Revision <span className="text-surface-500">(optional)</span>
            </label>
            <input
              id="revision"
              type="text"
              value={revision}
              onChange={e => setRevision(e.target.value)}
              placeholder="e.g. Rev C"
              disabled={isPending}
              className="input w-full"
            />
          </div>
        </div>

        {/* Specific question */}
        <div className="space-y-1.5">
          <label htmlFor="query" className="label">
            Specific question <span className="text-surface-500">(optional)</span>
          </label>
          <textarea
            id="query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. What are the insulation requirements for this line? Are there any pressure test hold points marked?"
            rows={2}
            disabled={isPending}
            className="input w-full resize-none"
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-surface-600">
            Analysis typically takes 10–30 seconds depending on drawing complexity.
          </p>
          <button
            type="submit"
            disabled={isPending || !drawingUrl.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Analyse Drawing
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results or empty state */}
      {result ? <ResultPanel result={result} /> : <EmptyState />}
    </div>
  )
}
