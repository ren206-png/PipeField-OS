'use client'
// ============================================================
// Daily Field Report — Edit Page
// ============================================================
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useDfr, useUpdateDfr } from '@/hooks/useDfr'
import { useProjects } from '@/hooks/useProjects'

const schema = z.object({
  project_id:      z.string().min(1, 'Project is required'),
  report_date:     z.string().min(1, 'Date is required'),
  supervisor_name: z.string().optional(),
  crew_size:       z.coerce.number().min(0).default(0),
  weather:         z.enum(['clear','cloudy','rain','snow','wind','extreme_heat','fog']).optional(),
  temperature:     z.string().optional(),
  work_areas:      z.string().optional(),
  work_completed:  z.string().min(1, 'Work completed is required'),
  welds_completed: z.coerce.number().min(0).default(0),
  spools_completed:z.coerce.number().min(0).default(0),
  equipment_used:  z.string().optional(),
  materials_used:  z.string().optional(),
  issues_delays:   z.string().optional(),
  safety_incidents:z.string().optional(),
  visitors:        z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function EditDfrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: report, isLoading } = useDfr(id)
  const { data: projects = [] } = useProjects()
  const updateDfr = useUpdateDfr()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: report ? {
      project_id:       report.project_id,
      report_date:      report.report_date,
      supervisor_name:  report.supervisor_name ?? '',
      crew_size:        report.crew_size,
      weather:          report.weather ?? undefined,
      temperature:      report.temperature ?? '',
      work_areas:       report.work_areas ?? '',
      work_completed:   report.work_completed,
      welds_completed:  report.welds_completed,
      spools_completed: report.spools_completed,
      equipment_used:   report.equipment_used ?? '',
      materials_used:   report.materials_used ?? '',
      issues_delays:    report.issues_delays ?? '',
      safety_incidents: report.safety_incidents ?? '',
      visitors:         report.visitors ?? '',
    } : undefined,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (report && report.status !== 'draft') {
    return (
      <div className="max-w-xl mx-auto text-center py-16 card">
        <p className="text-surface-400">This report has been submitted and can no longer be edited.</p>
        <Link href={`/daily-reports/${id}`} className="btn-primary mt-4 inline-flex">View Report</Link>
      </div>
    )
  }

  async function onSubmit(values: FormValues) {
    await updateDfr.mutateAsync({
      id,
      ...values,
      supervisor_name:  values.supervisor_name  || null,
      weather:          values.weather          ?? null,
      temperature:      values.temperature      || null,
      work_areas:       values.work_areas        || null,
      equipment_used:   values.equipment_used   || null,
      materials_used:   values.materials_used   || null,
      issues_delays:    values.issues_delays    || null,
      safety_incidents: values.safety_incidents || null,
      visitors:         values.visitors         || null,
    })
    router.push(`/daily-reports/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/daily-reports/${id}`} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Edit Daily Field Report</h1>
          {report && (
            <p className="text-sm font-mono text-brand-300 mt-0.5">{report.report_number}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Section 1 — Report Info */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">
            Report Info
          </h2>

          <div>
            <label className="label">Project <span className="text-red-400">*</span></label>
            <select className="input" {...register('project_id')}>
              <option value="">Select a project…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.project_id && <p className="field-error">{errors.project_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Report Date <span className="text-red-400">*</span></label>
              <input type="date" className="input" {...register('report_date')} />
              {errors.report_date && <p className="field-error">{errors.report_date.message}</p>}
            </div>
            <div>
              <label className="label">Crew Size</label>
              <input type="number" min={0} className="input" {...register('crew_size')} />
            </div>
          </div>

          <div>
            <label className="label">Supervisor Name</label>
            <input type="text" className="input" {...register('supervisor_name')} />
          </div>
        </div>

        {/* Section 2 — Site Conditions */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">
            Site Conditions
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Weather</label>
              <select className="input" {...register('weather')}>
                <option value="">Select…</option>
                <option value="clear">☀️ Clear</option>
                <option value="cloudy">☁️ Cloudy</option>
                <option value="rain">🌧️ Rain</option>
                <option value="snow">❄️ Snow</option>
                <option value="wind">💨 Windy</option>
                <option value="extreme_heat">🌡️ Extreme Heat</option>
                <option value="fog">🌫️ Fog</option>
              </select>
            </div>
            <div>
              <label className="label">Temperature</label>
              <input type="text" className="input" placeholder="e.g. 28°C / 82°F" {...register('temperature')} />
            </div>
          </div>

          <div>
            <label className="label">Work Areas</label>
            <input type="text" className="input" placeholder="Unit 3, Pipe Rack A, Module 5" {...register('work_areas')} />
          </div>
        </div>

        {/* Section 3 — Work Completed */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">
            Work Completed
          </h2>

          <div>
            <label className="label">Work Completed <span className="text-red-400">*</span></label>
            <textarea
              rows={4}
              className="input resize-none"
              {...register('work_completed')}
            />
            {errors.work_completed && <p className="field-error">{errors.work_completed.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Welds Completed Today</label>
              <input type="number" min={0} className="input" {...register('welds_completed')} />
            </div>
            <div>
              <label className="label">Spools Completed Today</label>
              <input type="number" min={0} className="input" {...register('spools_completed')} />
            </div>
          </div>
        </div>

        {/* Section 4 — Resources */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">
            Resources
          </h2>
          <div>
            <label className="label">Equipment Used</label>
            <textarea rows={2} className="input resize-none" {...register('equipment_used')} />
          </div>
          <div>
            <label className="label">Materials Used</label>
            <textarea rows={2} className="input resize-none" {...register('materials_used')} />
          </div>
        </div>

        {/* Section 5 — Issues & Safety */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-200 border-b border-surface-700 pb-2">
            Issues &amp; Safety
          </h2>
          <div>
            <label className="label">Issues / Delays</label>
            <textarea rows={2} className="input resize-none" {...register('issues_delays')} />
          </div>
          <div>
            <label className="label">Safety Incidents</label>
            <textarea rows={2} className="input resize-none" placeholder="None" {...register('safety_incidents')} />
          </div>
          <div>
            <label className="label">Visitors on Site</label>
            <input type="text" className="input" {...register('visitors')} />
          </div>
        </div>

        {/* Submit */}
        {updateDfr.error && (
          <p className="field-error text-sm">{String((updateDfr.error as Error).message)}</p>
        )}

        <div className="flex items-center gap-3 justify-end pb-6">
          <Link href={`/daily-reports/${id}`} className="btn-ghost">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={isSubmitting || updateDfr.isPending}>
            {updateDfr.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
