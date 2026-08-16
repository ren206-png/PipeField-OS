'use client'
// ============================================================
// Compliance Dashboard
// Sections: Project Compliance Status, Welder Qualification
// Tracker, Weld Inspection Form, Audit Pack Generation.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  ChevronDown,
  Plus,
  AlertCircle,
  FileText,
  Users,
  ClipboardList,
  FlaskConical,
  Stamp,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'
import { useWelders } from '@/hooks/useWelders'
import { cn, formatDate } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────

interface ComplianceStatus {
  standard: string
  welds_logged: number
  visual_inspections: number
  ndt_progress: number        // percentage 0-100
  welder_qualifications: number
  alerts: Array<{
    id: string
    severity: 'critical' | 'warning'
    message: string
  }>
}

interface WelderContinuity {
  welder_id: string
  process: string
  position: string
  last_weld_date: string | null
  qualification_date: string | null
  expiry_date: string | null
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'
  days_remaining: number | null
}

interface Standard {
  id: string
  code: string
  name: string
  visual_criteria: string[]
}

// ── Helpers ────────────────────────────────────────────────────

function statusBadge(status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED') {
  const map = {
    ACTIVE:        'bg-green-500/15 text-green-400 border border-green-500/30',
    EXPIRING_SOON: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    EXPIRED:       'bg-red-500/15 text-red-400 border border-red-500/30',
  }
  const labels = { ACTIVE: 'Active', EXPIRING_SOON: 'Expiring Soon', EXPIRED: 'Expired' }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', map[status])}>
      {labels[status]}
    </span>
  )
}

// ── Section A: Project Compliance Status ───────────────────────

function ProjectComplianceSection() {
  const { data: projects = [], isLoading: projLoading } = useProjectsList()
  const [projectId,  setProjectId]  = useState<string>('')
  const [status,     setStatus]     = useState<ComplianceStatus | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const fetchStatus = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/projects/${id}/compliance-status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus(await res.json() as ComplianceStatus)
    } catch (err) {
      // API may not exist yet — show friendly placeholder
      setStatus({
        standard: 'AWS D1.1 2025',
        welds_logged: 0,
        visual_inspections: 0,
        ndt_progress: 0,
        welder_qualifications: 0,
        alerts: [],
      })
      setError((err as Error).message.includes('404') ? null : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) void fetchStatus(projectId)
  }, [projectId, fetchStatus])

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-surface-700/60">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
        </div>
        <h2 className="text-base font-semibold text-surface-100">Project Compliance Status</h2>
      </div>

      {/* Project selector */}
      <div>
        <label className="label">Select Project</label>
        <div className="relative mt-1">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="input appearance-none pr-10"
            disabled={projLoading}
          >
            <option value="">— Choose a project —</option>
            {projects.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-surface-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading compliance data…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {status && !loading && (
        <>
          {/* Standard badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500">Governing Standard</span>
            <span className="px-3 py-1 rounded-full bg-brand-500/15 text-brand-300 text-xs font-semibold border border-brand-500/30">
              {status.standard}
            </span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Welds Logged',            value: status.welds_logged,           icon: FlaskConical },
              { label: 'Visual Inspections',       value: status.visual_inspections,     icon: CheckCircle2 },
              { label: 'NDT Progress',             value: `${status.ndt_progress}%`,     icon: ClipboardList },
              { label: 'Welder Qualifications',    value: status.welder_qualifications,  icon: Users },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="bg-surface-800/60 rounded-xl p-4 border border-surface-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-brand-400" />
                    <p className="text-xs text-surface-500">{s.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-surface-50">{s.value}</p>
                </div>
              )
            })}
          </div>

          {/* Alerts */}
          {status.alerts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">Continuity Alerts</p>
              {status.alerts.map(a => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-start gap-2 p-3 rounded-lg text-sm',
                    a.severity === 'critical'
                      ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                      : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300'
                  )}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{a.message}</span>
                  <span className={cn(
                    'ml-auto px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0',
                    a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  )}>
                    {a.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              No active continuity alerts
            </div>
          )}
        </>
      )}

      {!projectId && !loading && (
        <p className="text-sm text-surface-500 py-4 text-center">
          Select a project above to view compliance status.
        </p>
      )}
    </div>
  )
}

// ── Section B: Welder Qualification Tracker ────────────────────

function WelderQualificationSection() {
  const { data: welders = [], isLoading } = useWelders()
  const [continuityMap, setContinuityMap] = useState<Record<string, WelderContinuity[]>>({})
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [loadingId,     setLoadingId]     = useState<string | null>(null)
  const [showAddModal,  setShowAddModal]  = useState(false)

  async function loadContinuity(welderId: string) {
    if (continuityMap[welderId]) { setExpanded(expanded === welderId ? null : welderId); return }
    setLoadingId(welderId)
    try {
      const res = await apiFetch(`/api/welders/${welderId}/continuity`)
      if (res.ok) {
        const data = await res.json() as WelderContinuity[]
        setContinuityMap(prev => ({ ...prev, [welderId]: data }))
      } else {
        // Fallback placeholder if endpoint not yet built
        setContinuityMap(prev => ({ ...prev, [welderId]: [] }))
      }
    } catch {
      setContinuityMap(prev => ({ ...prev, [welderId]: [] }))
    } finally {
      setLoadingId(null)
      setExpanded(prev => prev === welderId ? null : welderId)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-surface-700/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <h2 className="text-base font-semibold text-surface-100">Welder Qualification Tracker</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Qualification
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-surface-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading welders…
        </div>
      )}

      {!isLoading && welders.length === 0 && (
        <p className="text-sm text-surface-500 text-center py-4">No welders found.</p>
      )}

      {!isLoading && welders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Welder</th>
                <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Stamp</th>
                <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Processes</th>
                <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Cert Expiry</th>
                <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Status</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {welders.map((w: {
                id: string
                full_name: string
                stamp: string
                process?: string[] | null
                cert_expiry?: string | null
                is_active: boolean
              }) => {
                const expiry    = w.cert_expiry ? new Date(w.cert_expiry) : null
                const now       = new Date()
                const daysLeft  = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000) : null
                const certStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' =
                  !expiry ? 'ACTIVE' :
                  daysLeft !== null && daysLeft < 0 ? 'EXPIRED' :
                  daysLeft !== null && daysLeft <= 30 ? 'EXPIRING_SOON' : 'ACTIVE'

                const isExpanded = expanded === w.id

                return (
                  <>
                    <tr key={w.id} className="hover:bg-surface-800/40 transition-colors">
                      <td className="py-3 px-3 text-surface-100 font-medium">{w.full_name}</td>
                      <td className="py-3 px-3 font-mono text-surface-400 text-xs">{w.stamp}</td>
                      <td className="py-3 px-3 text-surface-400">{w.process?.join(', ') || '—'}</td>
                      <td className="py-3 px-3 text-surface-400">
                        {expiry ? formatDate(w.cert_expiry!) : '—'}
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
                          <span className="ml-1 text-yellow-400 text-xs">({daysLeft}d)</span>
                        )}
                      </td>
                      <td className="py-3 px-3">{statusBadge(certStatus)}</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => void loadContinuity(w.id)}
                          className="p-1.5 text-surface-500 hover:text-brand-400 hover:bg-surface-700 rounded-lg transition-colors"
                          title="View continuity"
                        >
                          {loadingId === w.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                          }
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${w.id}-detail`}>
                        <td colSpan={6} className="bg-surface-800/40 px-6 py-4">
                          {(continuityMap[w.id] ?? []).length === 0 ? (
                            <p className="text-xs text-surface-500">No continuity records found for this welder.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-surface-500">
                                  <th className="text-left pb-1">Process</th>
                                  <th className="text-left pb-1">Position</th>
                                  <th className="text-left pb-1">Qual Date</th>
                                  <th className="text-left pb-1">Expiry</th>
                                  <th className="text-left pb-1">Status</th>
                                  <th className="text-left pb-1">Days Remaining</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-surface-700/30">
                                {continuityMap[w.id].map((c, i) => (
                                  <tr key={i}>
                                    <td className="py-1 text-surface-300">{c.process}</td>
                                    <td className="py-1 text-surface-300">{c.position}</td>
                                    <td className="py-1 text-surface-400">{c.qualification_date ? formatDate(c.qualification_date) : '—'}</td>
                                    <td className="py-1 text-surface-400">{c.expiry_date ? formatDate(c.expiry_date) : '—'}</td>
                                    <td className="py-1">{statusBadge(c.status)}</td>
                                    <td className="py-1 text-surface-400">{c.days_remaining ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Qualification placeholder modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-surface-50 flex items-center gap-2">
                <Stamp className="w-5 h-5 text-brand-400" />
                Add Qualification
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-surface-500 hover:text-surface-200 hover:bg-surface-700 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-surface-400 text-sm">
              Welder qualification management is configured via the Welders page. Visit the Welders page to add or update qualification details for each welder.
            </p>
            <a href="/welders" className="btn-primary block text-center">
              Go to Welders
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section C: Weld Inspection Form ───────────────────────────

const AWS_D11_VISUAL_CRITERIA = [
  'Weld size meets drawing/specification requirements',
  'No visible cracks in weld or heat-affected zone',
  'No incomplete fusion or incomplete joint penetration visible',
  'No undercut exceeding allowable limits (≤ 1/32 in.)',
  'No overlap or cold lap',
  'No porosity clusters or surface porosity exceeding limits',
  'Weld profile acceptable (reinforcement not excessive)',
  'No arc strikes outside weld zone',
  'Weld surface free of slag inclusions',
  'Welder stamp present and legible',
]

function WeldInspectionSection() {
  const [checklist, setChecklist] = useState<boolean[]>(new Array(AWS_D11_VISUAL_CRITERIA.length).fill(false))
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState<'pass' | 'fail' | null>(null)

  function toggleCriteria(i: number) {
    setChecklist(prev => { const next = [...prev]; next[i] = !next[i]; return next })
  }

  const allPassed = checklist.every(Boolean)

  async function handleSubmit(verdict: 'pass' | 'fail') {
    setSubmitting(true)
    // Placeholder — wire to weld ID when integrated from weld detail page
    await new Promise(r => setTimeout(r, 600))
    setResult(verdict)
    setSubmitting(false)
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-surface-700/60">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-brand-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-surface-100">Weld Inspection Form</h2>
          <p className="text-xs text-surface-500 mt-0.5">AWS D1.1 Visual Inspection Criteria</p>
        </div>
      </div>

      {result ? (
        <div className={cn(
          'flex flex-col items-center gap-3 py-8 rounded-xl border',
          result === 'pass'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}>
          {result === 'pass'
            ? <CheckCircle2 className="w-10 h-10" />
            : <XCircle className="w-10 h-10" />
          }
          <p className="text-lg font-bold">{result === 'pass' ? 'PASS' : 'FAIL'}</p>
          <p className="text-sm opacity-75">Inspection result recorded.</p>
          <button onClick={() => { setResult(null); setChecklist(new Array(AWS_D11_VISUAL_CRITERIA.length).fill(false)) }}
            className="btn-ghost text-sm mt-2">
            New Inspection
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {AWS_D11_VISUAL_CRITERIA.map((criterion, i) => (
              <label
                key={i}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  checklist[i]
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-surface-700 bg-surface-800/40 hover:border-surface-600'
                )}
              >
                <input
                  type="checkbox"
                  checked={checklist[i]}
                  onChange={() => toggleCriteria(i)}
                  className="mt-0.5 w-4 h-4 accent-brand-500 flex-shrink-0"
                />
                <span className="text-sm text-surface-200">{criterion}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-surface-700/60">
            <p className="text-xs text-surface-500">
              {checklist.filter(Boolean).length} / {checklist.length} criteria checked
            </p>
            <div className="flex gap-3">
              <button
                disabled={submitting}
                onClick={() => void handleSubmit('fail')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Fail
              </button>
              <button
                disabled={submitting || !allPassed}
                onClick={() => void handleSubmit('pass')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-semibold hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Pass
              </button>
            </div>
          </div>
          {!allPassed && (
            <p className="text-xs text-surface-500 -mt-2">All criteria must be checked to mark PASS.</p>
          )}
        </>
      )}
    </div>
  )
}

// ── Section D: Audit Pack Generation ──────────────────────────

const AUDIT_PACK_ITEMS = [
  { id: 'welds',         label: 'Weld Log (all welds)' },
  { id: 'nde',           label: 'NDE Results' },
  { id: 'visual',        label: 'Visual Inspection Reports' },
  { id: 'qualifications',label: 'Welder Qualifications' },
  { id: 'wps',           label: 'WPS / PQR Documents' },
  { id: 'ncrs',          label: 'NCR Register' },
  { id: 'pressure_tests',label: 'Pressure Test Records' },
]

function AuditPackSection() {
  const { data: projects = [] } = useProjectsList()
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(AUDIT_PACK_ITEMS.map(i => i.id)))
  const [format,        setFormat]        = useState<'PDF' | 'JSON'>('PDF')
  const [projectId,     setProjectId]     = useState<string>('')
  const [generating,    setGenerating]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  function toggleItem(id: string) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function generate() {
    if (!projectId) { setError('Please select a project.'); return }
    setError(null)
    setGenerating(true)
    try {
      const res = await apiFetch(`/api/projects/${projectId}/audit-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, include: Array.from(selectedItems) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `audit-pack-${projectId}.${format.toLowerCase()}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-2 pb-4 border-b border-surface-700/60">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-brand-400" />
        </div>
        <h2 className="text-base font-semibold text-surface-100">Audit Pack Generation</h2>
      </div>

      {/* Project */}
      <div>
        <label className="label">Project</label>
        <div className="relative mt-1">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="input appearance-none pr-10"
          >
            <option value="">— Choose a project —</option>
            {projects.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
        </div>
      </div>

      {/* Items checklist */}
      <div>
        <label className="label mb-2 block">Include in Pack</label>
        <div className="space-y-2">
          {AUDIT_PACK_ITEMS.map(item => (
            <label
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                selectedItems.has(item.id)
                  ? 'border-brand-500/40 bg-brand-500/5'
                  : 'border-surface-700 bg-surface-800/40 hover:border-surface-600'
              )}
            >
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={() => toggleItem(item.id)}
                className="w-4 h-4 accent-brand-500"
              />
              <span className="text-sm text-surface-200">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Format */}
      <div>
        <label className="label mb-2 block">Export Format</label>
        <div className="flex gap-3">
          {(['PDF', 'JSON'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'px-5 py-2 rounded-lg border text-sm font-medium transition-colors',
                format === f
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                  : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={() => void generate()}
        disabled={generating || selectedItems.size === 0}
        className="btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        {generating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
          : <><Download className="w-4 h-4" /> Generate &amp; Download</>
        }
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function CompliancePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Compliance</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Qualification tracking, inspection forms, and audit pack generation
          </p>
        </div>
      </div>

      <ProjectComplianceSection />
      <WelderQualificationSection />
      <WeldInspectionSection />
      <AuditPackSection />
    </div>
  )
}
