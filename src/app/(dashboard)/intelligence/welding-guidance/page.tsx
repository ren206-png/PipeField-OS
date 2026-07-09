'use client'
// ============================================================
// /intelligence/welding-guidance — Standalone Welding Guidance
//
// Lets users query the AI for WPS recommendations and welding
// procedure guidance without being on the weld form.
// ============================================================
import { useState, FormEvent }        from 'react'
import { Flame, Send, Loader2, Shield, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { apiFetch }                   from '@/lib/apiFetch'
import { useWpsList }                 from '@/hooks/useWps'
import { useProjects }                from '@/hooks/useProjects'

// ── Types ─────────────────────────────────────────────────────
interface WpsMatch { wps_number: string; reason: string }
interface GuidanceResult {
  recommendation: string
  matched_wps:    WpsMatch[]
  cert_warnings:  string[]
  confidence:     'high' | 'medium' | 'low'
  knowledge_sources: { title: string; similarity: number }[]
}

const CONFIDENCE_STYLES = {
  high:   'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low:    'bg-surface-700 text-surface-400 border-surface-600',
}

const WELD_PROCESSES = ['SMAW', 'GTAW', 'GMAW', 'FCAW', 'SAW', 'MCAW']
const PIPE_SIZES     = ['½"','¾"','1"','1¼"','1½"','2"','2½"','3"','4"','6"','8"','10"','12"','14"','16"','18"','20"','24"']
const MATERIALS      = [
  'Carbon Steel (A106 Gr.B)', 'Stainless 304', 'Stainless 316',
  'Chrome-Moly P11', 'Chrome-Moly P22', 'Duplex 2205', 'Alloy 625', 'Other',
]

export default function WeldingGuidancePage() {
  const { data: wpsList    = [] } = useWpsList()
  const { data: projects   = [] } = useProjects()

  const [process,   setProcess  ] = useState('')
  const [size,      setSize     ] = useState('')
  const [material,  setMaterial ] = useState('')
  const [schedule,  setSchedule ] = useState('')
  const [projectId, setProjectId] = useState('')
  const [freeQuery, setFreeQuery] = useState('')
  const [loading,   setLoading  ] = useState(false)
  const [result,    setResult   ] = useState<GuidanceResult | null>(null)
  const [error,     setError    ] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!process && !material && !freeQuery) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await apiFetch('/api/ai/welding-guidance', {
        method: 'POST',
        body: JSON.stringify({
          weld: {
            process,
            size,
            material,
            schedule,
          },
          wps_candidates: wpsList.filter(w => w.is_active).map(w => ({
            id:                   w.id,
            wps_number:           w.wps_number,
            revision:             w.revision,
            process:              w.process,
            base_metal_p_numbers: w.base_metal_p_numbers,
            filler_material:      w.filler_material,
            thickness_min_in:     w.thickness_min_in,
            thickness_max_in:     w.thickness_max_in,
            position:             w.position,
            pwht_required:        w.pwht_required,
            is_active:            w.is_active,
          })),
          project_id: projectId || undefined,
          query:      freeQuery || undefined,
        }),
      })

      if (res.status === 402) { setError('Welding Guidance requires a Starter plan or higher.'); return }
      if (res.status === 503) { setError('Welding Guidance is not enabled. Contact your administrator.'); return }
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        setError(j.error ?? 'AI guidance unavailable. Please try again.')
        return
      }

      const j = await res.json() as { data: GuidanceResult }
      setResult(j.data)
    } catch {
      setError('Could not reach AI service. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-surface-50">Welding Guidance</h1>
          <p className="text-xs text-surface-500">AI-powered WPS recommendations from your procedures and knowledge base</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-5">

        {/* Weld parameters */}
        <div>
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Weld Parameters</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label">Process</label>
              <select value={process} onChange={e => setProcess(e.target.value)} className="input">
                <option value="">Select…</option>
                {WELD_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Pipe Size</label>
              <select value={size} onChange={e => setSize(e.target.value)} className="input">
                <option value="">Select…</option>
                {PIPE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Schedule</label>
              <input
                value={schedule}
                onChange={e => setSchedule(e.target.value)}
                className="input"
                placeholder="e.g. Sch 40"
              />
            </div>
            <div>
              <label className="label">Material</label>
              <select value={material} onChange={e => setMaterial(e.target.value)} className="input">
                <option value="">Select…</option>
                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Project scope */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Project (optional — scopes knowledge search)</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Free-form question */}
        <div>
          <label className="label">Additional question (optional)</label>
          <textarea
            value={freeQuery}
            onChange={e => setFreeQuery(e.target.value)}
            className="input min-h-[72px] resize-y"
            placeholder="e.g. What preheat is required for P11 pipe in cold weather conditions?"
          />
        </div>

        <button
          type="submit"
          disabled={loading || (!process && !material && !freeQuery)}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing…</>
            : <><Flame className="w-4 h-4" />Get Welding Guidance</>
          }
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-warning/20 bg-warning/5 text-warning">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card p-5 space-y-5">

          {/* Confidence + header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-200">Guidance Result</h2>
            <span className={`text-xs px-2 py-1 rounded-full border ${CONFIDENCE_STYLES[result.confidence]}`}>
              {result.confidence} confidence
            </span>
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-3">
            <Flame className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <p className="text-sm text-surface-200 leading-relaxed">{result.recommendation}</p>
          </div>

          {/* Matched WPS */}
          {result.matched_wps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Recommended WPS</p>
              {result.matched_wps.map((m, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-surface-800 border border-surface-700">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-mono text-sm text-surface-100">{m.wps_number}</span>
                    <p className="text-xs text-surface-400 mt-0.5">{m.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No WPS matched */}
          {result.matched_wps.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              No matching WPS found in your active procedures for these parameters.
            </div>
          )}

          {/* Cert warnings */}
          {result.cert_warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Certification Warnings</p>
              {result.cert_warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-surface-300">
                  <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />{w}
                </div>
              ))}
            </div>
          )}

          {/* Knowledge sources toggle */}
          {result.knowledge_sources.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSources(s => !s)}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300"
              >
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {result.knowledge_sources.length} knowledge source{result.knowledge_sources.length !== 1 ? 's' : ''} referenced
              </button>
              {showSources && (
                <div className="mt-2 space-y-1">
                  {result.knowledge_sources.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-surface-400 px-2 py-1 rounded bg-surface-800">
                      <span>{s.title}</span>
                      <span className="text-surface-600">{Math.round(s.similarity * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 pt-2 border-t border-surface-800 text-xs text-surface-500">
            <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            AI welding guidance is supplemental only. WPS selection must be confirmed by a qualified welding engineer or CWI before work commences.
          </div>
        </div>
      )}
    </div>
  )
}
