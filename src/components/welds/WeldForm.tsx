'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import type { WeldStatus } from '@/types'
import type { WpsRecord } from '@/hooks/useWps'
import { WeldingGuidancePanel } from '@/components/ai/WeldingGuidancePanel'

const weldSchema = z.object({
  project_id:          z.string().min(1, 'Project is required'),
  welder_stamp:        z.string().min(1, 'Welder stamp is required').max(10),
  welder_name:         z.string().min(1, 'Welder name is required').max(100),
  weld_date:           z.string().min(1, 'Weld date is required'),
  spool_number:        z.string().max(50).optional(),
  line_number:         z.string().max(50).optional(),
  pipe_size:           z.string().max(20).optional(),
  wall_thickness:      z.string().max(20).optional(),
  material:            z.string().max(100).optional(),
  weld_process:        z.string().max(50).optional(),
  wps_id:              z.string().nullable().optional(),
  notes:               z.string().max(1000).optional(),
  // Material Traceability fields (Module 3 — MATERIAL_TRACE flag)
  base_metal_heat_a:   z.string().max(100).optional().nullable(),
  base_metal_heat_b:   z.string().max(100).optional().nullable(),
  filler_batch_number: z.string().max(100).optional().nullable(),
})

export type WeldFormValues = z.infer<typeof weldSchema>

interface Project {
  id:   string
  name: string
}

interface WeldFormProps {
  projects:           Project[]
  wpsList?:           WpsRecord[]
  defaultValues?:     Partial<WeldFormValues>
  onSubmit:           (values: WeldFormValues) => Promise<void>
  submitLabel?:       string
  isLoading?:         boolean
  /** Pass true when the MATERIAL_TRACE feature flag is enabled */
  materialTraceEnabled?: boolean
  /** Existing heat numbers from org MTRs for autocomplete */
  heatNumbers?:       string[]
}

const WELD_PROCESSES = ['SMAW', 'GTAW', 'GMAW', 'FCAW', 'SAW', 'MCAW', 'OAW']

const PIPE_SIZES = [
  '½"', '¾"', '1"', '1¼"', '1½"', '2"', '2½"', '3"',
  '4"', '6"', '8"', '10"', '12"', '14"', '16"', '18"', '20"', '24"',
]

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

export function WeldForm({
  projects,
  wpsList = [],
  defaultValues,
  onSubmit,
  submitLabel          = 'Save Weld',
  isLoading            = false,
  materialTraceEnabled = false,
  heatNumbers          = [],
}: WeldFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WeldFormValues>({
    resolver:      zodResolver(weldSchema),
    defaultValues: {
      weld_date: new Date().toISOString().split('T')[0],
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Project & Date ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Project *</label>
          <select {...register('project_id')} className="input">
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.project_id && <p className="field-error">{errors.project_id.message}</p>}
        </div>

        <div>
          <label className="label">Weld Date *</label>
          <input type="date" {...register('weld_date')} className="input" />
          {errors.weld_date && <p className="field-error">{errors.weld_date.message}</p>}
        </div>
      </div>

      {/* ── Welder ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Welder Stamp *</label>
          <input
            {...register('welder_stamp')}
            className="input font-mono uppercase"
            placeholder="e.g. AB1"
            maxLength={10}
          />
          {errors.welder_stamp && <p className="field-error">{errors.welder_stamp.message}</p>}
        </div>

        <div>
          <label className="label">Welder Name *</label>
          <input
            {...register('welder_name')}
            className="input"
            placeholder="Full name"
          />
          {errors.welder_name && <p className="field-error">{errors.welder_name.message}</p>}
        </div>
      </div>

      {/* ── Pipe Details ── */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wide">
          Pipe Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label">Spool #</label>
            <input {...register('spool_number')} className="input font-mono" placeholder="SP-001" />
          </div>
          <div>
            <label className="label">Line #</label>
            <input {...register('line_number')} className="input font-mono" placeholder="L-001" />
          </div>
          <div>
            <label className="label">Pipe Size</label>
            <select {...register('pipe_size')} className="input">
              <option value="">Select…</option>
              {PIPE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Wall / Schedule</label>
            <input {...register('wall_thickness')} className="input" placeholder="Sch 40" />
          </div>
        </div>
      </div>

      {/* ── Process & Material ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Weld Process</label>
          <select {...register('weld_process')} className="input">
            <option value="">Select process…</option>
            {WELD_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Material</label>
          <select {...register('material')} className="input">
            <option value="">Select material…</option>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* ── WPS ── */}
      <div>
        <label className="label">Welding Procedure (WPS)</label>
        <select {...register('wps_id')} className="input">
          <option value="">— Select WPS (optional) —</option>
          {wpsList.filter(w => w.is_active).map(w => (
            <option key={w.id} value={w.id}>
              {w.wps_number} Rev {w.revision} — {w.process}
            </option>
          ))}
        </select>
      </div>

      {/* ── Material Traceability (Module 3 — MATERIAL_TRACE flag) ── */}
      {materialTraceEnabled && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wide">
            Material Traceability
          </h3>
          {/* Autocomplete datalist for heat number inputs */}
          <datalist id="heat-number-list">
            {heatNumbers.map(h => <option key={h} value={h} />)}
          </datalist>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Base Metal Heat A</label>
              <input
                {...register('base_metal_heat_a')}
                className="input font-mono uppercase"
                placeholder="e.g. A1234B"
                list="heat-number-list"
              />
            </div>
            <div>
              <label className="label">Base Metal Heat B</label>
              <input
                {...register('base_metal_heat_b')}
                className="input font-mono uppercase"
                placeholder="Butt welds only"
                list="heat-number-list"
              />
            </div>
            <div>
              <label className="label">Filler Batch / Lot</label>
              <input
                {...register('filler_batch_number')}
                className="input font-mono uppercase"
                placeholder="e.g. LOT-9988"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── AI Welding Guidance ── */}
      <WeldingGuidancePanel
        weldProcess={watch('weld_process')}
        pipeSize={watch('pipe_size')}
        wallThickness={watch('wall_thickness')}
        material={watch('material')}
        welderStamp={watch('welder_stamp')}
        wpsList={wpsList}
        projectId={watch('project_id')}
      />

      {/* ── Notes ── */}
      <div>
        <label className="label">Notes</label>
        <textarea
          {...register('notes')}
          className="input min-h-[80px] resize-y"
          placeholder="Any field notes, joint type, heat numbers…"
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full py-3 text-base"
      >
        {isLoading
          ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving…</>
          : submitLabel
        }
      </button>
    </form>
  )
}
