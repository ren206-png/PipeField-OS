'use client'
// ============================================================
// Turnover Generator — gap check, package generation, progress polling
// ============================================================
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'
import type { GapReport } from '@/lib/turnover-gap-check'

// ── Types ────────────────────────────────────────────────────

interface TurnoverPackage {
  id: string
  package_name: string
  status: 'pending' | 'generating' | 'complete' | 'failed'
  progress_pct: number
  content_hash: string | null
  gap_report: GapReport
  generated_at: string | null
  error_message: string | null
  created_at: string
}

// ── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: TurnoverPackage['status'] }) {
  const configs = {
    pending:    { label: 'Pending',    classes: 'bg-surface-700 text-surface-300' },
    generating: { label: 'Generating', classes: 'bg-blue-500/20 text-blue-300 animate-pulse' },
    complete:   { label: 'Complete',   classes: 'bg-green-500/20 text-green-300' },
    failed:     { label: 'Failed',     classes: 'bg-red-500/20 text-red-300' },
  }
  const cfg = configs[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', cfg.classes)}>
      {cfg.label}
    </span>
  )
}

// ── Progress bar ─────────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: TurnoverPackage['status'] }) {
  const color =
    status === 'complete' ? 'bg-green-500' :
    status === 'failed'   ? 'bg-red-500'   :
    'bg-blue-500'
  return (
    <div className="w-full bg-surface-700 rounded-full h-1.5 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Gap report display ───────────────────────────────────────

function GapReportDisplay({ report }: { report: GapReport }) {
  const errorGaps  = report.gaps.filter(g => g.severity === 'error')
  const warnGaps   = report.gaps.filter(g => g.severity === 'warning')
  const noGaps     = report.gaps.length === 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-surface-400">
        <span>Total welds: <strong className="text-surface-200">{report.total_welds}</strong></span>
      </div>

      {noGaps && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">Ready to Generate — no gaps detected</span>
        </div>
      )}

      {errorGaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Blocking Errors</p>
          {errorGaps.map(g => (
            <div
              key={g.field}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <div className="flex items-center gap-2 text-red-300">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{g.field}</span>
              </div>
              <span className="text-sm font-bold text-red-400">{g.count}</span>
            </div>
          ))}
        </div>
      )}

      {warnGaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Warnings</p>
          {warnGaps.map(g => (
            <div
              key={g.field}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{g.field}</span>
              </div>
              <span className="text-sm font-bold text-amber-400">{g.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Package row with progress polling ────────────────────────

function PackageRow({ pkg: initialPkg }: { pkg: TurnoverPackage }) {
  const isActive = initialPkg.status === 'pending' || initialPkg.status === 'generating'

  const { data: pkg = initialPkg } = useQuery<TurnoverPackage>({
    queryKey: ['turnover-package', initialPkg.id],
    queryFn: async () => {
      const res = await apiFetch(`/api/turnover/packages/${initialPkg.id}`)
      if (!res.ok) throw new Error('Failed to fetch package')
      return res.json() as Promise<TurnoverPackage>
    },
    enabled: isActive,
    refetchInterval: isActive ? 2000 : false,
    initialData: initialPkg,
  })

  return (
    <tr className="border-b border-surface-800 hover:bg-surface-800/40 transition-colors">
      <td className="px-4 py-3 text-sm text-surface-200 font-medium">{pkg.package_name}</td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <StatusBadge status={pkg.status} />
          {(pkg.status === 'pending' || pkg.status === 'generating') && (
            <ProgressBar pct={pkg.progress_pct} status={pkg.status} />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-surface-400">
        {new Date(pkg.created_at).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-surface-500">
        {pkg.content_hash ? `${pkg.content_hash.slice(0, 12)}…` : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-surface-400">
        {pkg.error_message ?? '—'}
      </td>
    </tr>
  )
}

// ── Generate modal ────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void
  onConfirm: (name: string) => void
  isLoading: boolean
}

function GenerateModal({ onClose, onConfirm, isLoading }: GenerateModalProps) {
  const [name, setName] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-surface-50">Generate Turnover Package</h3>
          <button onClick={onClose} className="p-1 text-surface-400 hover:text-surface-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-surface-400">
          Enter a name for this turnover package. The system will assemble all welds and NDE data,
          compute a SHA-256 content hash, and store the package record.
        </p>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Package Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Phase 1 Turnover — Rev A"
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 placeholder-surface-600 focus:outline-none focus:border-brand-500"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim() || isLoading}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function TurnoverPage() {
  const { data: projects = [] } = useProjectsList()
  const [projectId, setProjectId] = useState('')
  const [gapReport, setGapReport] = useState<GapReport | null>(null)
  const [gapError, setGapError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  // Packages list
  const {
    data: packages = [],
    refetch: refetchPackages,
  } = useQuery<TurnoverPackage[]>({
    queryKey: ['turnover-packages', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await apiFetch(`/api/turnover/packages?project_id=${projectId}`)
      if (!res.ok) throw new Error('Failed to load packages')
      return res.json() as Promise<TurnoverPackage[]>
    },
    enabled: !!projectId,
  })

  // Gap check mutation
  const gapCheckMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Select a project first')
      setGapError(null)
      const res = await apiFetch(`/api/turnover/gap-check?project_id=${projectId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Gap check failed')
      }
      return res.json() as Promise<GapReport>
    },
    onSuccess: (data) => setGapReport(data),
    onError:   (err: Error) => setGapError(err.message),
  })

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const res = await apiFetch('/api/turnover/packages', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, package_name: packageName }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Generation failed')
      }
      return res.json()
    },
    onSuccess: () => {
      setShowModal(false)
      void refetchPackages()
      void queryClient.invalidateQueries({ queryKey: ['turnover-packages', projectId] })
    },
  })

  const handleGenerate = useCallback((name: string) => {
    generateMutation.mutate(name)
  }, [generateMutation])

  const canGenerate = !!gapReport && !gapReport.has_blocking_gaps

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
          <Package className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Turnover Packages</h1>
          <p className="text-sm text-surface-400">Run a gap check and generate project handover packages</p>
        </div>
      </div>

      {/* Project selector */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Project</h2>
        <select
          value={projectId}
          onChange={e => {
            setProjectId(e.target.value)
            setGapReport(null)
            setGapError(null)
          }}
          className="w-full max-w-sm bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-100 focus:outline-none focus:border-brand-500"
        >
          <option value="">Select a project…</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Gap check */}
      {projectId && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Completeness Gap Check</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => gapCheckMutation.mutate()}
                disabled={gapCheckMutation.isPending}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {gapCheckMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                Run Gap Check
              </button>
              <button
                onClick={() => setShowModal(true)}
                disabled={!canGenerate || generateMutation.isPending}
                className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
                Generate Package
              </button>
            </div>
          </div>

          {gapError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {gapError}
            </div>
          )}

          {generateMutation.isError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {generateMutation.error instanceof Error ? generateMutation.error.message : 'Generation failed'}
            </div>
          )}

          {gapReport && <GapReportDisplay report={gapReport} />}

          {!gapReport && !gapError && !gapCheckMutation.isPending && (
            <p className="text-sm text-surface-500 italic">Run the gap check to see completeness status before generating.</p>
          )}
        </div>
      )}

      {/* Packages table */}
      {projectId && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-800">
            <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Generated Packages</h2>
          </div>
          {packages.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-surface-500">
              No packages generated yet for this project.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Content Hash</th>
                    <th className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <PackageRow key={pkg.id} pkg={pkg} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <GenerateModal
          onClose={() => setShowModal(false)}
          onConfirm={handleGenerate}
          isLoading={generateMutation.isPending}
        />
      )}
    </div>
  )
}
