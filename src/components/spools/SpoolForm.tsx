'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

const spoolSchema = z.object({
  project_id:      z.string().min(1, 'Project is required'),
  spool_number:    z.string().min(1, 'Spool number is required').max(50),
  revision:        z.string().max(5).optional(),
  pipe_size:       z.string().max(20).optional(),
  pipe_schedule:   z.string().max(20).optional(),
  material:        z.string().max(100).optional(),
  service:         z.string().max(100).optional(),
  design_pressure: z.string().optional(),   // stored as string, parsed to number
  design_temp:     z.string().optional(),
  total_length_in: z.string().optional(),
  isometric_ref:   z.string().max(100).optional(),
  area:            z.string().max(100).optional(),
  priority:        z.string().optional(),
  required_date:   z.string().optional(),
  notes:           z.string().max(2000).optional(),
})

export type SpoolFormValues = z.infer<typeof spoolSchema>

interface Project { id: string; name: string }

interface SpoolFormProps {
  projects:       Project[]
  defaultValues?: Partial<SpoolFormValues>
  onSubmit:       (values: SpoolFormValues) => Promise<void>
  submitLabel?:   string
  isLoading?:     boolean
}

const PIPE_SIZES = [
  '½"','¾"','1"','1¼"','1½"','2"','2½"','3"',
  '4"','6"','8"','10"','12"','14"','16"','18"','20"','24"',
]

const SCHEDULES = ['Sch 10','Sch 20','Sch 40','Sch 80','Sch 120','Sch 160','XXH','XH','STD']

const MATERIALS = [
  'Carbon Steel (A106 Gr.B)',
  'Stainless 304',
  'Stainless 316',
  'Chrome-Moly P11',
  'Chrome-Moly P22',
  'Duplex 2205',
  'Alloy 625',
  'Other',
]

export function SpoolForm({
  projects,
  defaultValues,
  onSubmit,
  submitLabel = 'Save Spool',
  isLoading   = false,
}: SpoolFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SpoolFormValues>({
    resolver:      zodResolver(spoolSchema),
    defaultValues: { priority: '5', revision: 'A', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Project + Spool # + Rev */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="label">Project *</label>
          <select {...register('project_id')} className="input">
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.project_id && <p className="field-error">{errors.project_id.message}</p>}
        </div>
        <div>
          <label className="label">Spool Number *</label>
          <input
            {...register('spool_number')}
            className="input font-mono uppercase"
            placeholder="SP-001"
          />
          {errors.spool_number && <p className="field-error">{errors.spool_number.message}</p>}
        </div>
        <div>
          <label className="label">Revision</label>
          <input {...register('revision')} className="input font-mono" placeholder="A" maxLength={5} />
        </div>
      </div>

      {/* Pipe spec card */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wide">
          Pipe Specification
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Pipe Size</label>
            <select {...register('pipe_size')} className="input">
              <option value="">Select…</option>
              {PIPE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Schedule</label>
            <select {...register('pipe_schedule')} className="input">
              <option value="">Select…</option>
              {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Material</label>
            <select {...register('material')} className="input">
              <option value="">Select…</option>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="label">Service</label>
            <input {...register('service')} className="input" placeholder="Steam, Water…" />
          </div>
          <div>
            <label className="label">Design Pressure (PSI)</label>
            <input {...register('design_pressure')} className="input" type="number" placeholder="150" />
          </div>
          <div>
            <label className="label">Design Temp (°F)</label>
            <input {...register('design_temp')} className="input" type="number" placeholder="350" />
          </div>
        </div>
      </div>

      {/* Tracking info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="label">Isometric Ref</label>
          <input {...register('isometric_ref')} className="input font-mono" placeholder="ISO-001-A" />
        </div>
        <div>
          <label className="label">Area / Unit</label>
          <input {...register('area')} className="input" placeholder="Unit 5" />
        </div>
        <div>
          <label className="label">Total Length (in)</label>
          <input {...register('total_length_in')} className="input" type="number" step="0.001" placeholder="0" />
        </div>
        <div>
          <label className="label">Priority (1=urgent)</label>
          <select {...register('priority')} className="input">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <option key={n} value={String(n)}>{n}{n === 1 ? ' — Urgent' : n === 5 ? ' — Normal' : n === 10 ? ' — Low' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Required date + notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Required By Date</label>
          <input type="date" {...register('required_date')} className="input" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            {...register('notes')}
            className="input min-h-[80px] resize-y"
            placeholder="Special requirements, hold points…"
          />
        </div>
      </div>

      <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 text-base">
        {isLoading
          ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving…</>
          : submitLabel
        }
      </button>
    </form>
  )
}
