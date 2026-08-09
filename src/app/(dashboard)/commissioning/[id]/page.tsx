'use client'
// ============================================================
// STP Detail — Checklist + Handover Certificates
// ============================================================
import { useState, use } from 'react'
import { useStp, useUpdateStp, useCreatePrecommItem, useUpdatePrecommItem, useDeletePrecommItem, useCreateCertificate, useUpdateCertificate, type SystemTurnoverPackage, type PrecommItem, type HandoverCertificate } from '@/hooks/useCommissioning'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft, Plus, Trash2, Loader2, CheckCircle2, Clock, AlertCircle,
  FileText, Award, X, ChevronDown, Edit2, Save
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ── Status configs ────────────────────────────────────────────
const ITEM_STATUS: Record<PrecommItem['status'], { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-surface-700 text-surface-400'  },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/15 text-yellow-300' },
  complete:    { label: 'Complete',    color: 'bg-green-500/15 text-green-300'   },
  na:          { label: 'N/A',         color: 'bg-surface-700 text-surface-500'  },
  rejected:    { label: 'Rejected',    color: 'bg-red-500/15 text-red-300'       },
}

const CERT_TYPE_LABELS: Record<HandoverCertificate['cert_type'], string> = {
  mechanical_completion: 'Mechanical Completion',
  pre_commissioning:     'Pre-Commissioning',
  commissioning:         'Commissioning',
  performance_test:      'Performance Test',
  final_acceptance:      'Final Acceptance',
}

const CERT_STATUS: Record<HandoverCertificate['status'], { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-surface-700 text-surface-400'  },
  issued:   { label: 'Issued',   color: 'bg-blue-500/15 text-blue-300'     },
  accepted: { label: 'Accepted', color: 'bg-green-500/15 text-green-300'   },
  rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-300'       },
}

const STP_STATUS_OPTIONS = [
  { value: 'not_started',          label: 'Not Started'           },
  { value: 'pre_comm_in_progress', label: 'Pre-Comm In Progress'  },
  { value: 'pre_comm_complete',    label: 'Pre-Comm Complete'     },
  { value: 'comm_in_progress',     label: 'Comm In Progress'      },
  { value: 'comm_complete',        label: 'Comm Complete'         },
  { value: 'accepted',             label: 'Accepted'              },
]

// ── Add Item Form ─────────────────────────────────────────────
function AddItemForm({ stpId, orgId, onDone }: { stpId: string; orgId: string; onDone: () => void }) {
  const create = useCreatePrecommItem()
  const [form, setForm] = useState({ activity: '', description: '', discipline: '', responsible_party: '' })
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      await create.mutateAsync({
        stp_id: stpId,
        sequence_no: 999,
        activity: form.activity,
        description: form.description || null,
        discipline: form.discipline || null,
        responsible_party: form.responsible_party || null,
        status: 'pending',
        completed_by: null, completed_date: null,
        verified_by: null, verified_date: null, comments: null,
      })
      onDone()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <form onSubmit={submit} className="border border-brand-500/30 rounded-xl p-4 bg-brand-500/5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Activity *</label>
          <input className="input" required placeholder="e.g. Verify P&ID line numbering" value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} />
        </div>
        <div>
          <label className="label">Discipline</label>
          <input className="input" placeholder="e.g. Piping" value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))} />
        </div>
        <div>
          <label className="label">Responsible Party</label>
          <input className="input" placeholder="e.g. Contractor QC" value={form.responsible_party} onChange={e => setForm(f => ({ ...f, responsible_party: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <input className="input" placeholder="Additional detail…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="btn-ghost text-sm">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary text-sm flex items-center gap-1.5">
          {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Item
        </button>
      </div>
    </form>
  )
}

// ── Checklist Row ─────────────────────────────────────────────
function ChecklistRow({ item, canEdit }: { item: PrecommItem; canEdit: boolean }) {
  const update = useUpdatePrecommItem()
  const del    = useDeletePrecommItem()
  const [editing, setEditing] = useState(false)
  const [comments, setComments] = useState(item.comments ?? '')

  async function updateStatus(status: PrecommItem['status']) {
    await update.mutateAsync({ id: item.id, stp_id: item.stp_id, status })
  }

  async function saveComments() {
    await update.mutateAsync({ id: item.id, stp_id: item.stp_id, comments: comments || null })
    setEditing(false)
  }

  const cfg = ITEM_STATUS[item.status]

  return (
    <tr className="border-b border-surface-800 hover:bg-surface-800/30 transition-colors group">
      <td className="px-4 py-3 text-xs text-surface-600 font-mono">{item.sequence_no || '—'}</td>
      <td className="px-4 py-3">
        <p className="text-sm text-surface-200">{item.activity}</p>
        {item.description && <p className="text-xs text-surface-500 mt-0.5">{item.description}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-surface-500">{item.discipline ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-surface-500">{item.responsible_party ?? '—'}</td>
      <td className="px-4 py-3">
        {canEdit ? (
          <select
            value={item.status}
            onChange={e => updateStatus(e.target.value as PrecommItem['status'])}
            className={cn('text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-brand-500 outline-none', cfg.color)}
            disabled={update.isPending}
          >
            {Object.entries(ITEM_STATUS).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        ) : (
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', cfg.color)}>{cfg.label}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input className="input text-xs py-1 h-7 w-40" value={comments} onChange={e => setComments(e.target.value)} />
            <button onClick={saveComments} className="text-green-400 hover:text-green-300"><Save className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing(false)} className="text-surface-500 hover:text-surface-300"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500 truncate max-w-[120px]">{item.comments ?? '—'}</span>
            {canEdit && <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-surface-400 transition-all"><Edit2 className="w-3 h-3" /></button>}
          </div>
        )}
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <button
            onClick={() => del.mutate({ id: item.id, stp_id: item.stp_id })}
            className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      )}
    </tr>
  )
}

// ── Add Certificate Form ──────────────────────────────────────
function AddCertForm({ stpId, orgId, onDone }: { stpId: string; orgId: string; onDone: () => void }) {
  const create = useCreateCertificate()
  const [form, setForm] = useState({
    cert_number: '', cert_type: 'mechanical_completion' as HandoverCertificate['cert_type'],
    contractor_rep: '', client_rep: '', issued_date: '', notes: '',
  })
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      await create.mutateAsync({
        stp_id: stpId,
        cert_number: form.cert_number,
        cert_type: form.cert_type,
        contractor_rep: form.contractor_rep || null,
        client_rep: form.client_rep || null,
        issued_date: form.issued_date || null,
        accepted_date: null,
        notes: form.notes || null,
        status: 'draft',
        created_by: null,
      })
      onDone()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <form onSubmit={submit} className="border border-purple-500/30 rounded-xl p-4 bg-purple-500/5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Cert Number *</label>
          <input className="input" required placeholder="CERT-001" value={form.cert_number} onChange={e => setForm(f => ({ ...f, cert_number: e.target.value }))} />
        </div>
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.cert_type} onChange={e => setForm(f => ({ ...f, cert_type: e.target.value as HandoverCertificate['cert_type'] }))}>
            {Object.entries(CERT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Contractor Rep</label>
          <input className="input" placeholder="Name" value={form.contractor_rep} onChange={e => setForm(f => ({ ...f, contractor_rep: e.target.value }))} />
        </div>
        <div>
          <label className="label">Client Rep</label>
          <input className="input" placeholder="Name" value={form.client_rep} onChange={e => setForm(f => ({ ...f, client_rep: e.target.value }))} />
        </div>
        <div>
          <label className="label">Issued Date</label>
          <input type="date" className="input" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="btn-ghost text-sm">Cancel</button>
        <button type="submit" disabled={create.isPending} className="btn-primary text-sm flex items-center gap-1.5">
          {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Certificate
        </button>
      </div>
    </form>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function StpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isOrgAdmin } = useAuth()
  const { data: stp, isLoading, error } = useStp(id)
  const updateStp = useUpdateStp()
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddCert, setShowAddCert] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  async function changeStatus(status: SystemTurnoverPackage['status']) {
    setStatusUpdating(true)
    try {
      await updateStp.mutateAsync({ id, status })
    } finally {
      setStatusUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-surface-800 rounded w-48" />
        <div className="card p-6 space-y-4">
          <div className="h-5 bg-surface-800 rounded w-64" />
          <div className="h-4 bg-surface-800 rounded w-40" />
        </div>
      </div>
    )
  }

  if (error || !stp) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-surface-400">STP not found</p>
        <Link href="/commissioning" className="btn-ghost mt-3 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
    )
  }

  const items = stp.precomm_items ?? []
  const certs = stp.handover_certificates ?? []
  const done  = items.filter(i => i.status === 'complete' || i.status === 'na').length
  const pct   = items.length > 0 ? Math.round((done / items.length) * 100) : 0

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div>
        <Link href="/commissioning" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Commissioning
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-mono text-surface-500">{stp.stp_number}</span>
              {stp.discipline && (
                <span className="badge bg-surface-700 text-surface-400 text-xs">{stp.discipline}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-surface-50">{stp.system_name}</h1>
            {stp.system_description && (
              <p className="text-sm text-surface-500 mt-1">{stp.system_description}</p>
            )}
          </div>
          {isOrgAdmin && (
            <div className="flex items-center gap-2">
              <select
                value={stp.status}
                onChange={e => changeStatus(e.target.value as SystemTurnoverPackage['status'])}
                disabled={statusUpdating}
                className="input text-sm py-1.5 pr-8"
              >
                {STP_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {statusUpdating && <Loader2 className="w-4 h-4 animate-spin text-brand-400" />}
            </div>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Responsible Engr', value: stp.responsible_engineer ?? '—' },
          { label: 'Client Rep',       value: stp.client_rep ?? '—' },
          { label: 'Pre-Comm Target',  value: stp.pre_comm_target_date ? new Date(stp.pre_comm_target_date).toLocaleDateString() : '—' },
          { label: 'Comm Target',      value: stp.comm_target_date ? new Date(stp.comm_target_date).toLocaleDateString() : '—' },
        ].map(f => (
          <div key={f.label} className="card p-4">
            <p className="text-xs text-surface-500 mb-1">{f.label}</p>
            <p className="text-sm font-medium text-surface-200">{f.value}</p>
          </div>
        ))}
      </div>

      {/* ── Checklist ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-100">Pre-commissioning Checklist</h2>
              <p className="text-xs text-surface-500">{done}/{items.length} complete — {pct}%</p>
            </div>
          </div>
          {isOrgAdmin && (
            <button onClick={() => setShowAddItem(!showAddItem)} className="btn-ghost text-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          )}
        </div>

        {/* Progress bar */}
        {items.length > 0 && (
          <div className="px-5 py-2 bg-surface-900">
            <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {showAddItem && stp.organization_id && (
          <div className="p-4 border-b border-surface-800">
            <AddItemForm stpId={stp.id} orgId={stp.organization_id} onDone={() => setShowAddItem(false)} />
          </div>
        )}

        {items.length === 0 && !showAddItem ? (
          <div className="p-8 text-center">
            <Clock className="w-8 h-8 text-surface-600 mx-auto mb-2" />
            <p className="text-surface-500 text-sm">No checklist items yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-surface-500 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2.5 text-xs text-surface-500 font-medium">Activity</th>
                  <th className="text-left px-4 py-2.5 text-xs text-surface-500 font-medium">Discipline</th>
                  <th className="text-left px-4 py-2.5 text-xs text-surface-500 font-medium">Responsible</th>
                  <th className="text-left px-4 py-2.5 text-xs text-surface-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs text-surface-500 font-medium">Comments</th>
                  {isOrgAdmin && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <ChecklistRow key={item.id} item={item} canEdit={isOrgAdmin} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Handover Certificates ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-surface-100">Handover Certificates</h2>
              <p className="text-xs text-surface-500">{certs.length} certificate{certs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {isOrgAdmin && (
            <button onClick={() => setShowAddCert(!showAddCert)} className="btn-ghost text-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Certificate
            </button>
          )}
        </div>

        {showAddCert && stp.organization_id && (
          <div className="p-4 border-b border-surface-800">
            <AddCertForm stpId={stp.id} orgId={stp.organization_id} onDone={() => setShowAddCert(false)} />
          </div>
        )}

        {certs.length === 0 && !showAddCert ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-surface-600 mx-auto mb-2" />
            <p className="text-surface-500 text-sm">No certificates issued yet</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {certs.map((cert: HandoverCertificate) => {
              const cfg = CERT_STATUS[cert.status]
              return (
                <CertCard key={cert.id} cert={cert} canEdit={isOrgAdmin} />
              )
            })}
          </div>
        )}
      </div>

      {stp.notes && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-300 mb-2">Notes</h3>
          <p className="text-sm text-surface-500 whitespace-pre-wrap">{stp.notes}</p>
        </div>
      )}
    </div>
  )
}

function CertCard({ cert, canEdit }: { cert: HandoverCertificate; canEdit: boolean }) {
  const update = useUpdateCertificate()
  const cfg = CERT_STATUS[cert.status]

  async function updateStatus(status: HandoverCertificate['status']) {
    await update.mutateAsync({ id: cert.id, stp_id: cert.stp_id, status })
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-surface-800/20 transition-colors group">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
          <Award className="w-4 h-4 text-purple-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-surface-200">{cert.cert_number}</span>
            <span className="text-xs text-surface-500">{CERT_TYPE_LABELS[cert.cert_type]}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {cert.contractor_rep && <span className="text-xs text-surface-500">Contractor: {cert.contractor_rep}</span>}
            {cert.client_rep && <span className="text-xs text-surface-500">Client: {cert.client_rep}</span>}
            {cert.issued_date && <span className="text-xs text-surface-500">Issued: {new Date(cert.issued_date).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {canEdit ? (
          <select
            value={cert.status}
            onChange={e => updateStatus(e.target.value as HandoverCertificate['status'])}
            className={cn('text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer outline-none', cfg.color)}
            disabled={update.isPending}
          >
            {Object.entries(CERT_STATUS).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        ) : (
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', cfg.color)}>{cfg.label}</span>
        )}
      </div>
    </div>
  )
}
