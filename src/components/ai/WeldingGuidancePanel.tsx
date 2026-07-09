'use client'
// ============================================================
// WeldingGuidancePanel
//
// Inline AI panel on the weld creation / edit form.
// Calls /api/ai/welding-guidance with the current form values
// and displays WPS recommendations + cert warnings.
//
// Rendered as a collapsible card beneath the WPS selector.
// Visible only when PFOS_INTELLIGENCE_WELDING_GUIDANCE is ON
// (the API will return 503 otherwise — panel stays hidden).
// ============================================================
import { useState }                         from 'react'
import { Brain, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Loader2, Sparkles } from 'lucide-react'
import { apiFetch }                          from '@/lib/apiFetch'
import type { WpsRecord }                    from '@/hooks/useWps'

// ── Types ─────────────────────────────────────────────────────
interface WpsRecordMatch {
  wps_number: string
  reason:     string
}

interface GuidanceResult {
  recommendation:    string
  matched_wps:       WpsRecordMatch[]
  cert_warnings:     string[]
  confidence:        'high' | 'medium' | 'low'
}

interface WeldingGuidancePanelProps {
  weldProcess?:   string
  pipeSize?:      string
  wallThickness?: string
  material?:      string
  welderStamp?:   string
  wpsList?:       WpsRecord[]
  projectId?:     string
}

// ── Confidence badge ──────────────────────────────────────────
const CONFIDENCE_STYLES = {
  high:   'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low:    'bg-surface-700 text-surface-400 border-surface-600',
}

// ── Component ─────────────────────────────────────────────────
export function WeldingGuidancePanel({
  weldProcess,
  pipeSize,
  wallThickness,
  material,
  welderStamp,
  wpsList = [],
  projectId,
}: WeldingGuidancePanelProps) {
  const [open,    setOpen   ] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result,  setResult ] = useState<GuidanceResult | null>(null)
  const [error,   setError  ] = useState<string | null>(null)

  // Don't render if no meaningful weld context yet
  const hasContext = weldProcess || pipeSize || material

  async function fetchGuidance() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await apiFetch('/api/ai/welding-guidance', {
        method: 'POST',
        body: JSON.stringify({
          weld: {
            process:        weldProcess,
            size:           pipeSize,
            schedule:       wallThickness,
            material,
          },
          wps_candidates: wpsList.filter(w => w.is_active).map(w => ({
            id:                    w.id,
            wps_number:            w.wps_number,
            revision:              w.revision,
            process:               w.process,
            base_metal_p_numbers:  w.base_metal_p_numbers,
            filler_material:       w.filler_material,
            thickness_min_in:      w.thickness_min_in,
            thickness_max_in:      w.thickness_max_in,
            position:              w.position,
            pwht_required:         w.pwht_required,
            is_active:             w.is_active,
          })),
          welder: welderStamp ? { stamp: welderStamp } : undefined,
          project_id: projectId,
        }),
      })

      if (res.status === 402) {
        setError('WPS guidance requires a Starter plan or higher.')
        return
      }
      if (res.status === 503) {
        // Engine disabled — silently hide panel
        setOpen(false)
        return
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? 'AI guidance unavailable')
        return
      }

      const json = await res.json() as { data: GuidanceResult }
      setResult(json.data)
    } catch {
      setError('Could not reach AI service. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && !result && !loading) {
      fetchGuidance()
    }
  }

  if (!hasContext) return null

  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 overflow-hidden">

      {/* ── Toggle header ── */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-medium text-brand-300">AI Welding Guidance</span>
          {result && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLES[result.confidence]}`}>
              {result.confidence} confidence
            </span>
          )}
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-surface-500" />
          : <ChevronDown className="w-4 h-4 text-surface-500" />
        }
      </button>

      {/* ── Panel body ── */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-brand-500/10">

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 pt-4 text-surface-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Analysing weld parameters…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="pt-4 flex items-start gap-2 text-warning">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="pt-3 space-y-4">

              {/* Recommendation */}
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                <p className="text-sm text-surface-200 leading-relaxed">{result.recommendation}</p>
              </div>

              {/* Matched WPS */}
              {result.matched_wps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Recommended WPS</p>
                  {result.matched_wps.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                      <div>
                        <span className="font-mono text-surface-100">{m.wps_number}</span>
                        <span className="text-surface-400 ml-2">{m.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cert warnings */}
              {result.cert_warnings.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2">
                  <p className="text-xs font-semibold text-warning uppercase tracking-wide">Certification Warnings</p>
                  {result.cert_warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-surface-300">
                      <AlertTriangle className="w-3 h-3 text-warning mt-0.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchGuidance}
                className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2"
              >
                Refresh guidance
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-surface-600 leading-relaxed border-t border-surface-800 pt-3">
            AI guidance is supplemental only. WPS selection must be confirmed by a qualified welding engineer or CWI.
          </p>
        </div>
      )}
    </div>
  )
}
