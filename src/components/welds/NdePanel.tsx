'use client'
import { useState } from 'react'
import { Plus, FlaskConical, Loader2, X, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNdeInspections, useCreateNdeInspection, useUpdateNdeResult, useDeleteNdeInspection } from '@/hooks/useNde'
import {
  NDE_TYPE_LABELS, NDE_RESULT_COLORS,
  type NdeType, type NdeResult, type NdeInspection,
} from '@/types'
import { formatDate } from '@/lib/utils'

const NDE_TYPES:    NdeType[]   = ['RT','UT','PT','MT','VT','PMI','HT']
const NDE_RESULTS:  NdeResult[] = ['pending','pass','fail','repair','retest']

const schema = z.object({
  inspection_type: z.enum(['RT','UT','PT','MT','VT','PMI','HT']),
  result:          z.enum(['pending','pass','fail','repair','retest']),
  inspector_name:  z.string().optional(),
  inspection_date: z.string().optional(),
  report_number:   z.string().optional(),
  acceptance_code: z.string().optional(),
  defect_type:     z.string().optional(),
  defect_location: z.string().optional(),
  notes:           z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const RESULT_LABELS: Record<NdeResult, string> = {
  pending: 'Pending',
  pass:    'Pass',
  fail:    'Fail',
  repair:  'Repair Required',
  retest:  'Retest',
}

interface NdePanelProps {
  weldId:    string
  projectId: string
}

export function NdePanel({ weldId, projectId }: NdePanelProps) {
  const { data: inspections = [], isLoading } = useNdeInspections(weldId)
  const createInspection = useCreateNdeInspection()
  const updateResult     = useUpdateNdeResult()
  const deleteInspection = useDeleteNdeInspection()

  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { inspection_type: 'RT', result: 'pending' } })

  const resultWatch = watch('result')

  async function onSubmit(values: FormValues) {
    await createInspection.mutateAsync({
      weld_id:         weldId,
      project_id:      projectId,
      inspection_type: values.inspection_type as NdeType,
      result:          values.result as NdeResult,
      inspector_name:  values.inspector_name  || null,
      inspection_date: values.inspection_date || null,
      report_number:   values.report_number   || null,
      acceptance_code: values.acceptance_code || null,
      defect_type:     values.defect_type     || null,
      defect_location: values.defect_location || null,
      film_location:   null,
      repair_weld_id:  null,
      notes:           values.notes           || null,
    })
    reset()
    setShowForm(false)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-surface-100 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-purple-400" />
          NDE / Inspections
          {inspections.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-surface-700 text-xs text-surface-400">{inspections.length}</span>
          )}
        </h3>
        <button onClick={() => setShowForm(s => !s)} className="btn-ghost text-xs flex items-center gap-1">
          {showForm ? <><X className="w-3.5 h-3.5" />Cancel</> : <><Plus className="w-3.5 h-3.5" />Add</>}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 bg-surface-800 rounded-xl border border-surface-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type *</label>
              <select className="input" {...register('inspection_type')}>
                {NDE_TYPES.map(t => <option key={t} value={t}>{t} — {NDE_TYPE_LABELS[t].split('(')[0].trim()}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Result *</label>
              <select className="input" {...register('result')}>
                {NDE_RESULTS.map(r => <option key={r} value={r}>{RESULT_LABELS[r]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Inspector</label>
              <input className="input" placeholder="Name" {...register('inspector_name')} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" {...register('inspection_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Report #</label>
              <input className="input" placeholder="RT-2024-001" {...register('report_number')} />
            </div>
            <div>
              <label className="label">Acceptance Code</label>
              <input className="input" placeholder="ASME B31.3 §341" {...register('acceptance_code')} />
            </div>
          </div>

          {/* Defect fields — only shown when result is fail/repair */}
          {(resultWatch === 'fail' || resultWatch === 'repair') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Defect Type</label>
                <input className="input" placeholder="porosity, crack…" {...register('defect_type')} />
              </div>
              <div>
                <label className="label">Defect Location</label>
                <input className="input" placeholder="6 o'clock, 10mm" {...register('defect_location')} />
              </div>
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input resize-none" {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary text-sm flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Inspection
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading && <p className="text-sm text-surface-500">Loading…</p>}

      {!isLoading && inspections.length === 0 && !showForm && (
        <p className="text-sm text-surface-500 text-center py-4">No inspections recorded yet.</p>
      )}

      <div className="space-y-2">
        {inspections.map((ins: NdeInspection) => (
          <div key={ins.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-800/60 border border-surface-700/60">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-surface-100">{ins.inspection_type}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${NDE_RESULT_COLORS[ins.result]}`}>
                  {RESULT_LABELS[ins.result]}
                </span>
                {ins.report_number && (
                  <span className="text-xs font-mono text-surface-500">#{ins.report_number}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-surface-500 flex-wrap">
                {ins.inspector_name  && <span>{ins.inspector_name}</span>}
                {ins.inspection_date && <span>{formatDate(ins.inspection_date)}</span>}
                {ins.acceptance_code && <span className="font-mono">{ins.acceptance_code}</span>}
              </div>
              {ins.defect_type && (
                <p className="text-xs text-orange-400 mt-1">
                  Defect: {ins.defect_type}{ins.defect_location ? ` @ ${ins.defect_location}` : ''}
                </p>
              )}
              {ins.notes && <p className="text-xs text-surface-400 mt-1">{ins.notes}</p>}
            </div>

            {/* Quick result update */}
            <div className="flex items-center gap-1">
              <select
                value={ins.result}
                onChange={e => updateResult.mutate({ id: ins.id, result: e.target.value as NdeResult })}
                className="text-xs bg-surface-700 border border-surface-600 rounded-lg px-2 py-1.5 text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {NDE_RESULTS.map(r => <option key={r} value={r}>{RESULT_LABELS[r]}</option>)}
              </select>
              <button
                onClick={() => setDeleteId(ins.id)}
                className="p-1.5 text-surface-600 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-surface-50">Delete Inspection Record?</h3>
            <p className="text-surface-400 text-sm">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-ghost">Cancel</button>
              <button
                onClick={async () => {
                  const ins = inspections.find(i => i.id === deleteId)
                  if (ins) await deleteInspection.mutateAsync({ id: deleteId, weldId: ins.weld_id, projectId: ins.project_id })
                  setDeleteId(null)
                }}
                className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
