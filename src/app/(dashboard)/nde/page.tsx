'use client'
// ============================================================
// NDE Engine — Module 2
// Plan creation, deterministic weld selection, result recording.
//
// ENGINEERING_REVIEW_REQUIRED: All NDE sampling percentages
// and progressive penalty thresholds shown here are engineering
// defaults loaded from the code profile. They MUST be reviewed
// and approved by a qualified engineer before use in any
// code-compliant NDE program.
// ============================================================
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import {
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Plus,
  X,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
interface NdeCodeProfile {
  id: string
  profile_name: string
  sampling_pct_rt: number
  sampling_pct_ut: number
  progressive_trigger_count: number
  progressive_add_pct: number
  acceptance_standard: string
  created_at: string
}

interface NdePlan {
  id: string
  project_id: string
  code_profile_id: string
  plan_date: string
  status: 'draft' | 'active' | 'closed'
  created_at: string
  selection_count: number
  code_profile: { profile_name: string; acceptance_standard: string } | null
}

interface NdeSelection {
  id: string
  weld_id: string
  inspection_type: string
  selection_rank: number
  selection_reason: string
  result: string | null
  result_notes: string | null
  result_at: string | null
  selection_seed: string
  created_at: string
}

// ── Status badge ───────────────────────────────────────────────
const PLAN_STATUS: Record<string, { label: string; color: string }> = {
  draft:  { label: 'Draft',  color: 'bg-surface-700 text-surface-400'  },
  active: { label: 'Active', color: 'bg-brand-500/15 text-brand-300'   },
  closed: { label: 'Closed', color: 'bg-green-500/15 text-green-300'   },
}

const RESULT_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pass:    { label: 'Pass',    color: 'bg-green-500/15 text-green-300',  icon: CheckCircle2 },
  fail:    { label: 'Fail',    color: 'bg-red-500/15 text-red-300',      icon: XCircle      },
  pending: { label: 'Pending', color: 'bg-surface-700 text-surface-400', icon: Clock        },
}

const REASON_LABEL: Record<string, string> = {
  random_sample:       'Random Sample',
  progressive_penalty: 'Progressive Penalty',
  repair_followup:     'Repair Follow-up',
}

// ── Engineering Note Banner ────────────────────────────────────
function EngineeringBanner({ note }: { note?: string | null }) {
  if (!note) return null
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-amber-300 mb-0.5">ENGINEERING REVIEW REQUIRED</p>
        <p className="text-xs text-amber-400/80 leading-relaxed">{note}</p>
      </div>
    </div>
  )
}

// ── Create Plan Modal ──────────────────────────────────────────
function CreatePlanModal({
  profiles,
  onClose,
  onCreated,
  projectId,
}: {
  profiles: NdeCodeProfile[]
  onClose: () => void
  onCreated: () => void
  projectId: string
}) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const [planDate, setPlanDate]   = useState(new Date().toISOString().split('T')[0])
  const [err, setErr]             = useState<string | null>(null)

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/nde/plans', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, code_profile_id: profileId, plan_date: planDate }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to create plan')
      }
      return res.json() as Promise<NdePlan>
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: (e: Error) => setErr(e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-800">
          <h2 className="text-base font-semibold text-surface-100">Create NDE Plan</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {err && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {err}
            </div>
          )}

          <div>
            <label className="label mb-1.5">Code Profile</label>
            {profiles.length === 0 ? (
              <p className="text-sm text-surface-500">No profiles yet — create one first.</p>
            ) : (
              <div className="relative">
                <select
                  className="input pr-8 appearance-none"
                  value={profileId}
                  onChange={e => setProfileId(e.target.value)}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.profile_name} ({p.acceptance_standard})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              </div>
            )}
          </div>

          <div>
            <label className="label mb-1.5">Plan Date</label>
            <input
              type="date"
              className="input"
              value={planDate}
              onChange={e => setPlanDate(e.target.value)}
            />
          </div>

          <EngineeringBanner note="ENGINEERING_REVIEW_REQUIRED: Sampling percentages and progressive penalty thresholds are set in the code profile. Review with a qualified engineer before activating this plan." />
        </div>

        <div className="flex gap-3 px-6 py-5 border-t border-surface-800">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => create()}
            disabled={isPending || !profileId}
            className="btn-primary flex-1"
          >
            {isPending ? 'Creating…' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Plan Card ──────────────────────────────────────────────────
function PlanCard({
  plan,
  onRunSelection,
  isRunning,
}: {
  plan: NdePlan
  onRunSelection: (planId: string) => void
  isRunning: boolean
}) {
  const [expanded, setExpanded]       = useState(false)
  const [runResult, setRunResult]     = useState<{ seed: string | null; engineering_note: string | null; selections_created: number } | null>(null)

  // selections for this plan
  const { data: selections = [], isLoading: selLoading, refetch: refetchSel } = useQuery({
    queryKey: ['nde-selections', plan.id],
    enabled: expanded,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiFetch(`/api/nde/selections?nde_plan_id=${plan.id}`)
      if (!res.ok) return []
      return res.json() as Promise<NdeSelection[]>
    },
  })

  const statusCfg = PLAN_STATUS[plan.status] ?? PLAN_STATUS.draft

  const qc = useQueryClient()

  const handleRun = useCallback(async () => {
    const res = await apiFetch(`/api/nde/plans/${plan.id}/run-selection`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setRunResult(data)
      setExpanded(true)
      refetchSel()
    }
  }, [plan.id, refetchSel])

  const { mutate: recordResult, isPending: isRecording } = useMutation({
    mutationFn: async ({ selId, result }: { selId: string; result: 'pass' | 'fail' }) => {
      const res = await apiFetch(`/api/nde/selections/${selId}/result`, {
        method: 'PATCH',
        body: JSON.stringify({ result }),
      })
      if (!res.ok) throw new Error('Failed to record result')
      return res.json()
    },
    onSuccess: () => {
      refetchSel()
      qc.invalidateQueries({ queryKey: ['nde-plans'] })
    },
  })

  return (
    <div className="card overflow-hidden">
      {/* Plan header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', statusCfg.color)}>
              {statusCfg.label}
            </span>
            <span className="text-xs text-surface-500">
              {plan.code_profile?.profile_name ?? '—'} · {plan.code_profile?.acceptance_standard ?? '—'}
            </span>
          </div>
          <p className="text-sm text-surface-300 font-medium">
            Plan Date: {new Date(plan.plan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-xs text-surface-600 mt-0.5">{plan.selection_count} selection(s)</p>
        </div>

        <div className="flex items-center gap-2">
          {plan.status === 'active' && (
            <button
              onClick={() => { onRunSelection(plan.id); handleRun() }}
              disabled={isRunning}
              className="btn-primary flex items-center gap-1.5 text-sm py-1.5 px-3"
            >
              {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Selection
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="btn-ghost text-sm py-1.5 px-3"
          >
            {expanded ? 'Hide' : 'Show'} Selections
          </button>
        </div>
      </div>

      {/* Run result */}
      {runResult && (
        <div className="px-5 pb-4">
          <EngineeringBanner note={runResult.engineering_note} />
          <p className="text-xs text-surface-500 mt-2">
            {runResult.selections_created} selection(s) created · Seed: <span className="font-mono text-brand-400 break-all">{runResult.seed}</span>
          </p>
        </div>
      )}

      {/* Selections table */}
      {expanded && (
        <div className="border-t border-surface-800">
          {selLoading ? (
            <div className="p-6 space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-surface-800 rounded" />)}
            </div>
          ) : selections.length === 0 ? (
            <div className="p-8 text-center">
              <FlaskConical className="w-8 h-8 text-surface-600 mx-auto mb-2" />
              <p className="text-surface-500 text-sm">No selections yet. Run Selection to generate.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-900/50 border-b border-surface-800">
                    {['Rank', 'Weld', 'Type', 'Reason', 'Result', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-surface-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/60">
                  {selections.map(s => {
                    const rCfg = RESULT_CFG[s.result ?? 'pending'] ?? RESULT_CFG.pending
                    const RIcon = rCfg.icon
                    return (
                      <tr key={s.id} className="hover:bg-surface-800/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-surface-500 font-mono">#{s.selection_rank}</td>
                        <td className="px-4 py-3 text-xs font-mono text-surface-400 max-w-[120px] truncate">{s.weld_id}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-surface-300 bg-surface-700 px-2 py-0.5 rounded">
                            {s.inspection_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-surface-500">
                          {REASON_LABEL[s.selection_reason] ?? s.selection_reason}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <RIcon className={cn('w-3.5 h-3.5', s.result === 'pass' ? 'text-green-400' : s.result === 'fail' ? 'text-red-400' : 'text-surface-500')} />
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', rCfg.color)}>
                              {rCfg.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(!s.result || s.result === 'pending') && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => recordResult({ selId: s.id, result: 'pass' })}
                                disabled={isRecording}
                                className="text-xs px-2 py-1 rounded bg-green-500/15 text-green-300 hover:bg-green-500/25 transition-colors"
                              >
                                Pass
                              </button>
                              <button
                                onClick={() => recordResult({ selId: s.id, result: 'fail' })}
                                disabled={isRecording}
                                className="text-xs px-2 py-1 rounded bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors"
                              >
                                Fail
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function NdePage() {
  const { data: projects = [] } = useProjectsList()
  const [projectId, setProjectId]     = useState<string>('')
  const [showCreate, setShowCreate]   = useState(false)
  const [runningId, setRunningId]     = useState<string | null>(null)

  const qc = useQueryClient()

  // Load code profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['nde-profiles'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiFetch('/api/nde/profiles')
      if (!res.ok) return []
      return res.json() as Promise<NdeCodeProfile[]>
    },
  })

  // Load plans for selected project
  const { data: plans = [], isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['nde-plans', projectId],
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiFetch(`/api/nde/plans?project_id=${projectId}`)
      if (!res.ok) return []
      return res.json() as Promise<NdePlan[]>
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-brand-400" />
            NDE Engine
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Deterministic weld selection for Non-Destructive Examination programs
          </p>
        </div>
      </div>

      {/* ENGINEERING_REVIEW_REQUIRED banner — always visible */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-300 mb-0.5">ENGINEERING REVIEW REQUIRED</p>
          <p className="text-xs text-amber-400/80 leading-relaxed">
            ENGINEERING_REVIEW_REQUIRED: All NDE sampling percentages and progressive penalty
            thresholds are engineering defaults stored in the code profile. They must be reviewed
            and approved by a qualified engineer before use in a code-compliant NDE program.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label className="label mb-1.5">Project</label>
            <div className="relative">
              <select
                className="input pr-8 appearance-none"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">— Select a project —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.project_number ? `${p.project_number} — ` : ''}{p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
            </div>
          </div>

          {projectId && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2"
              disabled={profiles.length === 0}
              title={profiles.length === 0 ? 'Create a code profile first' : undefined}
            >
              <Plus className="w-4 h-4" />
              Create NDE Plan
            </button>
          )}
        </div>

        {projectId && profiles.length === 0 && (
          <p className="text-xs text-amber-400 mt-3">
            No code profiles found. Contact your admin to add an NDE code profile before creating plans.
          </p>
        )}
      </div>

      {/* Plans list */}
      {projectId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-surface-200">NDE Plans</h2>
            <button
              onClick={() => refetchPlans()}
              className="btn-ghost flex items-center gap-1.5 text-sm py-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {plansLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1,2].map(i => <div key={i} className="h-20 bg-surface-800 rounded-xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <div className="card p-10 text-center">
              <FlaskConical className="w-10 h-10 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 font-medium">No NDE plans yet</p>
              <p className="text-surface-600 text-sm mt-1">Create a plan to begin deterministic weld selection.</p>
            </div>
          ) : (
            plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onRunSelection={id => setRunningId(id)}
                isRunning={runningId === plan.id}
              />
            ))
          )}
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreate && projectId && (
        <CreatePlanModal
          profiles={profiles}
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['nde-plans', projectId] })
          }}
        />
      )}
    </div>
  )
}
