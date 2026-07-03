'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useItp, useUpdateItp, useCreateItpItem, useUpdateItpItem, useDeleteItpItem } from '@/hooks/useItp'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import {
  ITP_STATUS_LABELS,
  ITP_STATUS_COLORS,
  ITP_LEVEL_LABELS,
  ITP_LEVEL_SHORT,
  ITP_LEVEL_COLORS,
  ITP_ITEM_STATUS_COLORS,
  type ItpLevel,
  type ItpItemStatus,
  type ItpItem,
} from '@/types'
import { ArrowLeft, Plus, Trash2, CheckCircle, Award, PenLine } from 'lucide-react'
import SignatureModal from '@/components/shared/SignatureModal'
import { useSignatures } from '@/hooks/useSignatures'

const PIPING_ITP_TEMPLATE: Partial<ItpItem>[] = [
  { item_number: '1', activity: 'Material Verification (MTR Review)', contractor_level: 'perform', inspector_level: 'review', client_level: 'review', frequency: '100%', record_required: 'yes', record_type: 'MTR', reference_doc: 'ASME B31.3 §323' },
  { item_number: '2', activity: 'Fit-Up Inspection', contractor_level: 'perform', inspector_level: 'witness', client_level: 'monitor', frequency: '10%', record_required: 'yes', record_type: 'Fit-Up Report', reference_doc: 'ASME B31.3 §328' },
  { item_number: '3', activity: 'Weld Visual Inspection (VT)', contractor_level: 'perform', inspector_level: 'witness', client_level: 'monitor', frequency: '100%', record_required: 'yes', record_type: 'Weld Log' },
  { item_number: '4', activity: 'NDE — Radiographic Testing (RT)', contractor_level: 'perform', inspector_level: 'witness', client_level: 'review', frequency: '10%', record_required: 'yes', record_type: 'RT Report', reference_doc: 'ASME B31.3 Table 341.3.2' },
  { item_number: '5', activity: 'NDE — Liquid Penetrant (PT)', contractor_level: 'perform', inspector_level: 'witness', client_level: 'review', frequency: 'As required', record_required: 'yes', record_type: 'PT Report' },
  { item_number: '6', activity: 'Dimensional Inspection', contractor_level: 'perform', inspector_level: 'monitor', client_level: 'monitor', frequency: '100%', record_required: 'yes', record_type: 'Dimensional Report' },
  { item_number: '7', activity: 'Pressure Test (Hydrostatic)', contractor_level: 'perform', inspector_level: 'hold', client_level: 'witness', frequency: '100%', record_required: 'yes', record_type: 'Pressure Test Record', reference_doc: 'ASME B31.3 §345' },
  { item_number: '8', activity: 'Final Visual Inspection', contractor_level: 'perform', inspector_level: 'hold', client_level: 'witness', frequency: '100%', record_required: 'yes', record_type: 'Inspection Release Note' },
]

const CONTRACTOR_LEVELS: ItpLevel[] = ['perform','monitor','review','n_a']
const INSPECTOR_LEVELS: ItpLevel[] = ['hold','witness','review','monitor','n_a']
const CLIENT_LEVELS: ItpLevel[] = ['hold','witness','review','monitor','n_a']

function LevelChip({ level }: { level: ItpLevel }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${ITP_LEVEL_COLORS[level]}`}>
      {ITP_LEVEL_SHORT[level]}
    </span>
  )
}

interface AddForm {
  item_number: string
  activity: string
  description: string
  reference_doc: string
  acceptance_criteria: string
  contractor_level: ItpLevel
  inspector_level: ItpLevel
  client_level: ItpLevel
  frequency: string
  record_required: 'yes' | 'no'
  record_type: string
}

const defaultAddForm: AddForm = {
  item_number: '',
  activity: '',
  description: '',
  reference_doc: '',
  acceptance_criteria: '',
  contractor_level: 'perform',
  inspector_level: 'witness',
  client_level: 'review',
  frequency: '100%',
  record_required: 'yes',
  record_type: '',
}

export default function ItpDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: itp, isLoading } = useItp(id)
  const { isOrgAdmin } = useAuth()
  const updateItp = useUpdateItp()
  const createItem = useCreateItpItem()
  const updateItem = useUpdateItpItem()
  const deleteItem = useDeleteItpItem()

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(defaultAddForm)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [sigRole, setSigRole] = useState<string | null>(null)
  const { data: signatures = [] } = useSignatures('itp', id)

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-8 w-64 bg-surface-800 rounded animate-pulse mb-4" />
        <div className="card p-6 h-64 animate-pulse bg-surface-800" />
      </div>
    )
  }

  if (!itp) {
    return (
      <div className="p-6 text-center">
        <p className="text-surface-400">ITP not found.</p>
        <Link href="/documents/itps" className="btn-ghost mt-4 inline-flex">Back to ITPs</Link>
      </div>
    )
  }

  const items = itp.itp_items ?? []
  const completeCount = items.filter(i => i.status === 'complete').length
  const totalCount = items.length
  const pct = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    await createItem.mutateAsync({
      itp_id:              itp!.id,
      project_id:          itp!.project_id,
      item_number:         addForm.item_number,
      activity:            addForm.activity,
      description:         addForm.description || null,
      reference_doc:       addForm.reference_doc || null,
      acceptance_criteria: addForm.acceptance_criteria || null,
      contractor_level:    addForm.contractor_level,
      inspector_level:     addForm.inspector_level,
      client_level:        addForm.client_level,
      frequency:           addForm.frequency || null,
      record_required:     addForm.record_required,
      record_type:         addForm.record_type || null,
      status:              'pending',
      completed_date:      null,
      completed_by:        null,
      remarks:             null,
      sort_order:          items.length,
    })
    setAddForm(defaultAddForm)
    setShowAddForm(false)
  }

  async function handleLoadTemplate() {
    setLoadingTemplate(true)
    for (let i = 0; i < PIPING_ITP_TEMPLATE.length; i++) {
      const t = PIPING_ITP_TEMPLATE[i]
      await createItem.mutateAsync({
        itp_id:              itp!.id,
        project_id:          itp!.project_id,
        item_number:         t.item_number ?? String(i + 1),
        activity:            t.activity ?? '',
        description:         t.description ?? null,
        reference_doc:       t.reference_doc ?? null,
        acceptance_criteria: t.acceptance_criteria ?? null,
        contractor_level:    (t.contractor_level ?? 'perform') as ItpLevel,
        inspector_level:     (t.inspector_level ?? 'witness') as ItpLevel,
        client_level:        (t.client_level ?? 'review') as ItpLevel,
        frequency:           t.frequency ?? '100%',
        record_required:     t.record_required ?? 'yes',
        record_type:         t.record_type ?? null,
        status:              'pending',
        completed_date:      null,
        completed_by:        null,
        remarks:             null,
        sort_order:          i,
      })
    }
    setLoadingTemplate(false)
  }

  async function handleApprove() {
    if (!itp) return
    if (!confirm('Mark this ITP as Approved?')) return
    await updateItp.mutateAsync({ id: itp.id, status: 'approved' })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/documents/itps" className="btn-ghost p-2 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-mono font-bold text-brand-400 text-lg">{itp.itp_number}</span>
            {itp.revision && <span className="text-surface-400 text-sm">Rev {itp.revision}</span>}
            <span className={`badge ${ITP_STATUS_COLORS[itp.status]}`}>{ITP_STATUS_LABELS[itp.status]}</span>
            {itp.completed_at && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                ✓ Complete · {formatDate(itp.completed_at)}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-surface-50">{itp.title}</h1>
          {itp.project && (
            <p className="text-surface-400 text-sm mt-0.5">{itp.project.name} · {itp.discipline}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {itp.completed_at && (
            <a
              href={`/api/reports/itp-certificate?id=${itp.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded text-sm font-semibold bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors"
            >
              <Award className="w-4 h-4" />
              Certificate PDF
            </a>
          )}
          {itp.status === 'issued' && isOrgAdmin && (
            <button onClick={handleApprove} disabled={updateItp.isPending} className="btn-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Approve ITP
            </button>
          )}
          <button onClick={() => setShowAddForm(v => !v)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Activity
          </button>
        </div>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-surface-300 font-medium">
              {completeCount} of {totalCount} activities complete
            </span>
            <span className="text-sm font-bold text-surface-100">{pct}%</span>
          </div>
          <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Load template when empty */}
      {totalCount === 0 && itp.discipline === 'piping' && (
        <div className="card p-6 text-center border-dashed">
          <p className="text-surface-400 mb-3">No activities yet. Load the standard piping template to get started.</p>
          <button
            onClick={handleLoadTemplate}
            disabled={loadingTemplate}
            className="btn-primary"
          >
            {loadingTemplate ? 'Loading template…' : 'Load Piping Template'}
          </button>
        </div>
      )}

      {/* Add Activity Form */}
      {showAddForm && (
        <div className="card p-5 border-brand-500/30">
          <h3 className="font-semibold text-surface-100 mb-4">Add Inspection Activity</h3>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Item #</label>
                <input className="input w-full font-mono" placeholder="1" value={addForm.item_number}
                  onChange={e => setAddForm(f => ({ ...f, item_number: e.target.value }))} />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Activity <span className="text-red-400">*</span></label>
                <input className="input w-full" required placeholder="e.g. Weld Visual Inspection" value={addForm.activity}
                  onChange={e => setAddForm(f => ({ ...f, activity: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Description</label>
                <textarea className="input w-full" rows={2} value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Acceptance Criteria</label>
                <textarea className="input w-full" rows={2} value={addForm.acceptance_criteria}
                  onChange={e => setAddForm(f => ({ ...f, acceptance_criteria: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Reference Doc</label>
                <input className="input w-full" placeholder="ASME B31.3 §328" value={addForm.reference_doc}
                  onChange={e => setAddForm(f => ({ ...f, reference_doc: e.target.value }))} />
              </div>
              <div>
                <label className="label">Frequency</label>
                <input className="input w-full" placeholder="100%" value={addForm.frequency}
                  onChange={e => setAddForm(f => ({ ...f, frequency: e.target.value }))} />
              </div>
              <div>
                <label className="label">Record Type</label>
                <input className="input w-full" placeholder="Weld Log" value={addForm.record_type}
                  onChange={e => setAddForm(f => ({ ...f, record_type: e.target.value }))} />
              </div>
              <div>
                <label className="label">Record Required</label>
                <select className="input w-full" value={addForm.record_required}
                  onChange={e => setAddForm(f => ({ ...f, record_required: e.target.value as 'yes' | 'no' }))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Contractor Level</label>
                <select className="input w-full" value={addForm.contractor_level}
                  onChange={e => setAddForm(f => ({ ...f, contractor_level: e.target.value as ItpLevel }))}>
                  {CONTRACTOR_LEVELS.map(l => <option key={l} value={l}>{ITP_LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Inspector Level</label>
                <select className="input w-full" value={addForm.inspector_level}
                  onChange={e => setAddForm(f => ({ ...f, inspector_level: e.target.value as ItpLevel }))}>
                  {INSPECTOR_LEVELS.map(l => <option key={l} value={l}>{ITP_LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Client Level</label>
                <select className="input w-full" value={addForm.client_level}
                  onChange={e => setAddForm(f => ({ ...f, client_level: e.target.value as ItpLevel }))}>
                  {CLIENT_LEVELS.map(l => <option key={l} value={l}>{ITP_LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createItem.isPending} className="btn-primary">
                {createItem.isPending ? 'Adding…' : 'Add Activity'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ITP Table */}
      {items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-800 border-b border-surface-700">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide w-12">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide min-w-[160px]">Activity</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide min-w-[120px]">Reference</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-surface-400 uppercase tracking-wide w-12">CON</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-surface-400 uppercase tracking-wide w-12">INS</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-surface-400 uppercase tracking-wide w-12">CLT</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide w-20">Freq</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide min-w-[100px]">Record</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wide w-36">Status</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-surface-800/50 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs text-surface-400">{item.item_number}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-surface-200">{item.activity}</p>
                      {item.description && (
                        <p className="text-xs text-surface-500 mt-0.5">{item.description}</p>
                      )}
                      {item.acceptance_criteria && (
                        <p className="text-xs text-surface-600 mt-0.5 italic">✓ {item.acceptance_criteria}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-surface-400 font-mono">{item.reference_doc ?? '—'}</td>
                    <td className="px-3 py-3 text-center"><LevelChip level={item.contractor_level} /></td>
                    <td className="px-3 py-3 text-center"><LevelChip level={item.inspector_level} /></td>
                    <td className="px-3 py-3 text-center"><LevelChip level={item.client_level} /></td>
                    <td className="px-3 py-3 text-xs text-surface-400">{item.frequency ?? '—'}</td>
                    <td className="px-3 py-3">
                      {item.record_type && <p className="text-xs text-surface-300">{item.record_type}</p>}
                      <p className="text-xs text-surface-600">{item.record_required === 'yes' ? 'Required' : 'Not required'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="input text-xs py-1 px-2"
                        value={item.status}
                        onChange={e => updateItem.mutate({
                          id: item.id,
                          itp_id: item.itp_id,
                          status: e.target.value as ItpItemStatus,
                        })}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="not_applicable">N/A</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => {
                          if (confirm('Delete this activity?')) {
                            deleteItem.mutate({ id: item.id, itpId: item.itp_id })
                          }
                        }}
                        className="text-surface-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-surface-800 bg-surface-900/50">
            <div className="flex flex-wrap gap-3 text-xs text-surface-500">
              <span className="font-semibold text-surface-400">Key:</span>
              {(['hold','witness','review','monitor','perform'] as ItpLevel[]).map(l => (
                <span key={l} className="flex items-center gap-1">
                  <LevelChip level={l} />
                  <span>{ITP_LEVEL_LABELS[l]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Signatures */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          Signatures
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['QC Manager', 'Inspector'] as const).map(role => {
            const sig = signatures.find(s => s.role === role)
            return (
              <div key={role} className="border border-surface-700 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">{role}</p>
                {sig ? (
                  <div className="space-y-2">
                    <div className="bg-white rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sig.signature_data} alt={`${role} signature`} className="w-full max-h-24 object-contain p-1" />
                    </div>
                    <p className="text-xs text-surface-300 font-medium">{sig.signer_name}</p>
                    {sig.signer_title && <p className="text-xs text-surface-500">{sig.signer_title}</p>}
                    <p className="text-xs text-surface-600">{new Date(sig.signed_at).toLocaleString()}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setSigRole(role)}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-surface-600 rounded-lg py-6 text-sm text-surface-500 hover:border-brand-500 hover:text-brand-400 transition-colors"
                  >
                    <PenLine className="w-4 h-4" />
                    Sign as {role}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Signature modal */}
      {sigRole && (
        <SignatureModal
          open={!!sigRole}
          onClose={() => setSigRole(null)}
          onSigned={() => setSigRole(null)}
          recordType="itp"
          recordId={id}
          role={sigRole}
        />
      )}
    </div>
  )
}
