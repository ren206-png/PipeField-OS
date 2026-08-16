'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, Stamp, Phone, Mail, Pencil, Trash2, X, Loader2, ChevronDown, ChevronUp, Download, AlertCircle } from 'lucide-react'
import { RejectionRateCard } from '@/components/welders/RejectionRateCard'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useWelders, useCreateWelder, useUpdateWelder, useDeleteWelder } from '@/hooks/useWelders'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { WELD_PROCESSES, WELD_POSITIONS, type Welder } from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'

const schema = z.object({
  full_name:        z.string().min(2, 'Name required'),
  stamp:            z.string().min(1, 'Stamp required').max(20),
  email:            z.string().email().optional().or(z.literal('')),
  phone:            z.string().optional(),
  certification_no: z.string().optional(),
  cert_expiry:      z.string().optional(),
  is_active:        z.boolean(),
  notes:            z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ── Continuity types ──────────────────────────────────────────
interface WelderContinuity {
  welder_id: string
  process: string
  position: string
  last_weld_date: string | null
  qualification_date: string | null
  expiry_date: string | null
  status: 'ACTIVE' | 'CLOSE_TO_EXPIRY' | 'EXPIRED'
  days_remaining: number | null
}

function continuityBadge(status: 'ACTIVE' | 'CLOSE_TO_EXPIRY' | 'EXPIRED') {
  const map = {
    ACTIVE:          'bg-green-500/15 text-green-400 border border-green-500/30',
    CLOSE_TO_EXPIRY: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    EXPIRED:         'bg-red-500/15 text-red-400 border border-red-500/30',
  }
  const labels = { ACTIVE: 'Active', CLOSE_TO_EXPIRY: 'Expiring Soon', EXPIRED: 'Expired' }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', map[status])}>
      {labels[status]}
    </span>
  )
}

// ── Continuity Tab ─────────────────────────────────────────────

function ContinuityTab({ welders }: { welders: Welder[] }) {
  const { data: projects = [] } = useProjectsList()
  const [continuityMap, setContinuityMap] = useState<Record<string, WelderContinuity[]>>({})
  const [loadingAll,    setLoadingAll]    = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [exportError,   setExportError]   = useState<string | null>(null)
  const [projectId,     setProjectId]     = useState<string>('')
  const [loadError,     setLoadError]     = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (welders.length === 0) return
    setLoadingAll(true)
    setLoadError(null)
    try {
      const results = await Promise.all(
        welders.map(async w => {
          try {
            const res = await apiFetch(`/api/welders/${w.id}/continuity`)
            const data: WelderContinuity[] = res.ok ? await res.json() : []
            return [w.id, data] as const
          } catch {
            return [w.id, []] as const
          }
        })
      )
      setContinuityMap(Object.fromEntries(results))
    } catch (err) {
      setLoadError((err as Error).message)
    } finally {
      setLoadingAll(false)
    }
  }, [welders])

  useEffect(() => { void loadAll() }, [loadAll])

  async function exportReport() {
    const pid = projectId || (projects[0] as { id: string } | undefined)?.id
    if (!pid) { setExportError('No project available for export.'); return }
    setExporting(true)
    setExportError(null)
    try {
      const res = await apiFetch(`/api/projects/${pid}/audit-pack`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'JSON', include: ['qualifications'] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `continuity-report-${pid}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <div className="relative">
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="input text-sm py-1.5 appearance-none pr-8"
              >
                <option value="">First project (default)</option>
                {projects.map((p: { id: string; name: string }) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
            </div>
          )}
          <button
            onClick={() => void loadAll()}
            disabled={loadingAll}
            className="p-2 text-surface-500 hover:text-brand-400 hover:bg-surface-700 rounded-lg transition-colors"
            title="Refresh"
          >
            {loadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4 rotate-0" />}
          </button>
        </div>

        <button
          onClick={() => void exportReport()}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 text-surface-300 text-sm font-medium hover:bg-surface-600 hover:text-surface-100 transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export Continuity Report
        </button>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {exportError}
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {loadingAll && (
        <div className="flex items-center gap-2 text-surface-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading continuity data…
        </div>
      )}

      {!loadingAll && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {['Welder', 'Process', 'Position', 'Qual Date', 'Expiry', 'Status', 'Days Remaining'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {welders.flatMap(w => {
                const rows = continuityMap[w.id] ?? []
                if (rows.length === 0) {
                  return [(
                    <tr key={w.id} className="hover:bg-surface-800/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-surface-100">{w.full_name}</td>
                      <td colSpan={6} className="py-3 px-3 text-surface-500 text-xs italic">No continuity records</td>
                    </tr>
                  )]
                }
                return rows.map((c, i) => (
                  <tr key={`${w.id}-${i}`} className="hover:bg-surface-800/40 transition-colors">
                    {i === 0 && (
                      <td className="py-3 px-3 font-medium text-surface-100" rowSpan={rows.length}>{w.full_name}</td>
                    )}
                    <td className="py-3 px-3 text-surface-300">{c.process}</td>
                    <td className="py-3 px-3 text-surface-300">{c.position}</td>
                    <td className="py-3 px-3 text-surface-400 text-xs">{c.qualification_date ? formatDate(c.qualification_date) : '—'}</td>
                    <td className="py-3 px-3 text-surface-400 text-xs">{c.expiry_date ? formatDate(c.expiry_date) : '—'}</td>
                    <td className="py-3 px-3">{continuityBadge(c.status)}</td>
                    <td className={cn(
                      'py-3 px-3 text-sm font-medium',
                      c.status === 'EXPIRED'         ? 'text-red-400' :
                      c.status === 'CLOSE_TO_EXPIRY' ? 'text-yellow-400' : 'text-green-400'
                    )}>
                      {c.days_remaining !== null ? `${c.days_remaining}d` : '—'}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export default function WeldersPage() {
  const { data: welders = [], isLoading } = useWelders()
  const create  = useCreateWelder()
  const update  = useUpdateWelder()
  const destroy = useDeleteWelder()

  const [activeTab,   setActiveTab]   = useState<'welders' | 'continuity'>('welders')
  const [showForm,    setShowForm]    = useState(false)
  const [editing,     setEditing]     = useState<Welder | null>(null)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [processes,   setProcesses]   = useState<string[]>([])
  const [positions,   setPositions]   = useState<string[]>([])
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [formError,   setFormError]   = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { is_active: true } })

  function openNew() {
    setEditing(null)
    setProcesses([])
    setPositions([])
    reset({ is_active: true })
    setShowForm(true)
  }

  function openEdit(w: Welder) {
    setEditing(w)
    setProcesses(w.process ?? [])
    setPositions(w.position ?? [])
    reset({
      full_name:        w.full_name,
      stamp:            w.stamp,
      email:            w.email ?? '',
      phone:            w.phone ?? '',
      certification_no: w.certification_no ?? '',
      cert_expiry:      w.cert_expiry ?? '',
      is_active:        w.is_active,
      notes:            w.notes ?? '',
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditing(null); setFormError(null) }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const payload = {
      ...values,
      email:            values.email            || null,
      phone:            values.phone            || null,
      certification_no: values.certification_no || null,
      cert_expiry:      values.cert_expiry      || null,
      notes:            values.notes            || null,
      process:          processes,
      position:         positions,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload })
      } else {
        await create.mutateAsync(payload as Parameters<typeof create.mutateAsync>[0])
      }
      closeForm()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Unknown error'
      // Extract Supabase details if available
      const detail = (err as { details?: string; code?: string; hint?: string })
      setFormError(`${msg}${detail?.code ? ` (${detail.code})` : ''}${detail?.hint ? ` — ${detail.hint}` : ''}`)
    }
  }

  function toggleProcess(p: string) {
    setProcesses(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }
  function togglePosition(p: string) {
    setPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const isCertExpired = (expiry: string | null) =>
    expiry ? new Date(expiry) < new Date() : false

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Welders</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Manage certified welders and their stamps
          </p>
        </div>
        {activeTab === 'welders' && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Welder</span>
            <span className="sm:hidden">Add</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl border border-surface-700/50 w-fit">
        {[
          { id: 'welders',     label: 'Welders' },
          { id: 'continuity',  label: 'Continuity' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'welders' | 'continuity')}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'text-surface-400 hover:text-surface-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Continuity Tab */}
      {activeTab === 'continuity' && (
        <div className="card p-6">
          {isLoading
            ? <LoadingSpinner />
            : welders.length === 0
              ? <p className="text-sm text-surface-500 text-center py-4">No welders to show continuity for.</p>
              : <ContinuityTab welders={welders} />
          }
        </div>
      )}

      {activeTab === 'welders' && (
      <>

      {/* Stats bar */}
      {welders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Welders', value: welders.length },
            { label: 'Active',        value: welders.filter(w => w.is_active).length },
            { label: 'Cert Expiring', value: welders.filter(w => isCertExpired(w.cert_expiry)).length },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-surface-50">{s.value}</p>
              <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading && <LoadingSpinner />}

      {!isLoading && welders.length === 0 && (
        <EmptyState
          icon="🔧"
          title="No welders yet"
          description="Add your certified welders and their qualification stamps."
          action={{ label: 'Add First Welder', onClick: openNew }}
        />
      )}

      {!isLoading && welders.length > 0 && (
        <div className="space-y-3">
          {welders.map(w => {
            const expired = isCertExpired(w.cert_expiry)
            const open    = expanded === w.id
            return (
              <div key={w.id} className="card overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${w.is_active ? 'bg-brand-500/15 text-brand-400' : 'bg-surface-700 text-surface-400'}`}>
                    {w.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-surface-100">{w.full_name}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-700 text-xs font-mono text-surface-300">
                        <Stamp className="w-3 h-3" />
                        {w.stamp}
                      </span>
                      {!w.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-danger/15 text-red-400 text-xs font-medium">Inactive</span>
                      )}
                      {expired && w.cert_expiry && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-300 text-xs font-medium">Cert Expired</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-surface-500">
                      {w.process && w.process.length > 0 && (
                        <span>{w.process.join(' · ')}</span>
                      )}
                      {w.cert_expiry && (
                        <span className={expired ? 'text-orange-400' : ''}>
                          Cert exp: {formatDate(w.cert_expiry)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(w)} className="p-2 text-surface-500 hover:text-brand-400 hover:bg-surface-700 rounded-lg transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(w.id)} className="p-2 text-surface-500 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExpanded(open ? null : w.id)} className="p-2 text-surface-500 hover:text-surface-200 hover:bg-surface-700 rounded-lg transition-colors">
                      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {open && (
                  <div className="border-t border-surface-700 px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-surface-800/40">
                    <div>
                      <p className="text-xs text-surface-500 mb-1">Processes</p>
                      <p className="text-surface-200">{w.process?.join(', ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 mb-1">Positions</p>
                      <p className="text-surface-200">{w.position?.join(', ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 mb-1">Cert #</p>
                      <p className="text-surface-200 font-mono">{w.certification_no || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 mb-1">Contact</p>
                      <div className="space-y-0.5">
                        {w.email && <p className="text-surface-200 truncate"><Mail className="w-3 h-3 inline mr-1" />{w.email}</p>}
                        {w.phone && <p className="text-surface-200"><Phone className="w-3 h-3 inline mr-1" />{w.phone}</p>}
                        {!w.email && !w.phone && <p className="text-surface-500">—</p>}
                      </div>
                    </div>
                    {w.notes && (
                      <div className="col-span-full">
                        <p className="text-xs text-surface-500 mb-1">Notes</p>
                        <p className="text-surface-300">{w.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-surface-700">
              <h2 className="text-lg font-bold text-surface-50">
                {editing ? 'Edit Welder' : 'Add Welder'}
              </h2>
              <button onClick={closeForm} className="p-2 text-surface-500 hover:text-surface-200 hover:bg-surface-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono whitespace-pre-wrap">
                  {formError}
                </div>
              )}
              {/* Name + Stamp */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Full Name *</label>
                  <input className={errors.full_name ? 'input-error' : 'input'} placeholder="John Smith" {...register('full_name')} />
                  {errors.full_name && <p className="error-message">{errors.full_name.message}</p>}
                </div>
                <div>
                  <label className="label">Welder Stamp *</label>
                  <input className={errors.stamp ? 'input-error' : 'input'} placeholder="JS-01" {...register('stamp')} />
                  {errors.stamp && <p className="error-message">{errors.stamp.message}</p>}
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" placeholder="john@co.com" {...register('email')} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" className="input" placeholder="+1 555 0100" {...register('phone')} />
                </div>
              </div>

              {/* Processes */}
              <div>
                <label className="label">Weld Processes</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {WELD_PROCESSES.map(p => (
                    <button key={p} type="button"
                      onClick={() => toggleProcess(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${processes.includes(p) ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500'}`}
                    >{p}</button>
                  ))}
                </div>
              </div>

              {/* Positions */}
              <div>
                <label className="label">Qualified Positions</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {WELD_POSITIONS.map(p => (
                    <button key={p} type="button"
                      onClick={() => togglePosition(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${positions.includes(p) ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' : 'bg-surface-800 border-surface-700 text-surface-400 hover:border-surface-500'}`}
                    >{p}</button>
                  ))}
                </div>
              </div>

              {/* Cert */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Certification #</label>
                  <input className="input" placeholder="WPS-2024-001" {...register('certification_no')} />
                </div>
                <div>
                  <label className="label">Cert Expiry</label>
                  <input type="date" className="input" {...register('cert_expiry')} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea rows={2} className="input resize-none" {...register('notes')} />
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-brand-500" {...register('is_active')} />
                <span className="text-sm text-surface-200">Active (can be assigned to welds)</span>
              </label>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2 border-t border-surface-700">
                <button type="button" onClick={closeForm} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {editing ? 'Save Changes' : 'Add Welder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rejection Rate Dashboard ── */}
      {!isLoading && welders.length > 0 && (
        <RejectionRateCard />
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-surface-50">Delete Welder?</h3>
            <p className="text-surface-400 text-sm">This will permanently remove the welder. Existing weld records referencing this stamp will not be affected.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-ghost">Cancel</button>
              <button
                onClick={async () => { await destroy.mutateAsync(deleteId); setDeleteId(null) }}
                className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
