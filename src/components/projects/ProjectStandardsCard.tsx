'use client'
// ============================================================
// ProjectStandardsCard
// Displays and edits the international standards configuration
// for a project: governing code, jurisdiction, unit system,
// locale, AHJ, and PDF page size.
//
// Used inside the project settings / overview tab.
// ============================================================
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, BookOpen, Ruler, FileText, Save, ChevronDown } from 'lucide-react'
import { useCodeRegistry } from '@/hooks/useCodeRegistry'
import { cn } from '@/lib/utils'

export interface ProjectStandards {
  id:                  string
  governing_code:      string | null
  governing_code_year: number | null
  jurisdiction:        string | null
  unit_system:         'imperial' | 'si' | 'mixed' | null
  locale:              string | null
  ahj:                 string | null
  page_size:           'letter' | 'A4' | null
}

interface Props {
  project: ProjectStandards
}

const LOCALES = [
  { value: 'en-US',  label: 'English (US)' },
  { value: 'en-CA',  label: 'English (Canada)' },
  { value: 'en-GB',  label: 'English (UK)' },
  { value: 'en-AU',  label: 'English (Australia)' },
  { value: 'fr-CA',  label: 'Français (Canada)' },
  { value: 'fr-FR',  label: 'Français (France)' },
  { value: 'de-DE',  label: 'Deutsch' },
  { value: 'pt-BR',  label: 'Português (Brasil)' },
  { value: 'es-MX',  label: 'Español (México)' },
  { value: 'ar-SA',  label: 'العربية' },
  { value: 'zh-CN',  label: '中文 (简体)' },
]

async function patchStandards(projectId: string, data: Partial<ProjectStandards>) {
  const res = await fetch(`/api/projects/${projectId}/standards`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to save')
  }
  return res.json() as Promise<ProjectStandards>
}

export function ProjectStandardsCard({ project }: Props) {
  const qc = useQueryClient()
  const { data: codes = [], isLoading: codesLoading } = useCodeRegistry()

  const [form, setForm] = useState<Partial<ProjectStandards>>({
    governing_code:      project.governing_code      ?? null,
    governing_code_year: project.governing_code_year ?? null,
    jurisdiction:        project.jurisdiction        ?? null,
    unit_system:         project.unit_system         ?? 'imperial',
    locale:              project.locale              ?? 'en-US',
    ahj:                 project.ahj                 ?? null,
    page_size:           project.page_size           ?? 'letter',
  })

  const mutation = useMutation({
    mutationFn: (data: Partial<ProjectStandards>) => patchStandards(project.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project', project.id] })
    },
  })

  function handleCodeSelect(label: string) {
    // Extract year from label, e.g. 'ASME B31.3-2022 ...' → 2022
    const yearMatch = label.match(/-(\d{4})/)
    setForm(f => ({
      ...f,
      governing_code: label,
      governing_code_year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    }))
  }

  const inputCls = 'w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-100 focus:border-brand-500 focus:outline-none'
  const labelCls = 'block text-xs font-medium text-surface-400 uppercase tracking-wide mb-1'

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-surface-100">Standards & Jurisdiction</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Governing Code */}
        <div className="sm:col-span-2">
          <label className={labelCls}><BookOpen className="inline w-3 h-3 mr-1" />Governing Code</label>
          <div className="relative">
            <select
              value={form.governing_code ?? ''}
              onChange={e => handleCodeSelect(e.target.value)}
              disabled={codesLoading}
              className={cn(inputCls, 'appearance-none pr-8')}
            >
              <option value="">— Select governing code —</option>
              {codes.map(c => (
                <option key={c.id} value={c.label}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 w-4 h-4 text-surface-500" />
          </div>
        </div>

        {/* Jurisdiction */}
        <div>
          <label className={labelCls}><Globe className="inline w-3 h-3 mr-1" />Jurisdiction</label>
          <input
            type="text"
            value={form.jurisdiction ?? ''}
            onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value || null }))}
            placeholder="e.g. US-TX, CA-AB, GB, AU"
            className={inputCls}
          />
          <p className="text-xs text-surface-600 mt-1">ISO 3166-2 country/subdivision code</p>
        </div>

        {/* AHJ */}
        <div>
          <label className={labelCls}>Authority Having Jurisdiction (AHJ)</label>
          <input
            type="text"
            value={form.ahj ?? ''}
            onChange={e => setForm(f => ({ ...f, ahj: e.target.value || null }))}
            placeholder="e.g. Texas Railroad Commission"
            className={inputCls}
          />
        </div>

        {/* Unit System */}
        <div>
          <label className={labelCls}><Ruler className="inline w-3 h-3 mr-1" />Unit System</label>
          <div className="flex gap-2">
            {(['imperial', 'si', 'mixed'] as const).map(u => (
              <button
                key={u}
                type="button"
                onClick={() => setForm(f => ({ ...f, unit_system: u }))}
                className={cn(
                  'flex-1 rounded-lg py-2 text-xs font-medium transition-all capitalize',
                  form.unit_system === u
                    ? 'bg-brand-500 text-white'
                    : 'border border-surface-700 text-surface-400 hover:border-brand-500'
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Locale */}
        <div>
          <label className={labelCls}>Report Locale</label>
          <div className="relative">
            <select
              value={form.locale ?? 'en-US'}
              onChange={e => setForm(f => ({ ...f, locale: e.target.value }))}
              className={cn(inputCls, 'appearance-none pr-8')}
            >
              {LOCALES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 w-4 h-4 text-surface-500" />
          </div>
        </div>

        {/* Page Size */}
        <div>
          <label className={labelCls}><FileText className="inline w-3 h-3 mr-1" />PDF Page Size</label>
          <div className="flex gap-2">
            {(['letter', 'A4'] as const).map(ps => (
              <button
                key={ps}
                type="button"
                onClick={() => setForm(f => ({ ...f, page_size: ps }))}
                className={cn(
                  'flex-1 rounded-lg py-2 text-xs font-medium transition-all',
                  form.page_size === ps
                    ? 'bg-brand-500 text-white'
                    : 'border border-surface-700 text-surface-400 hover:border-brand-500'
                )}
              >
                {ps === 'letter' ? 'Letter (8.5×11")' : 'A4 (210×297mm)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-800">
        {mutation.isError && (
          <p className="text-xs text-red-400">{(mutation.error as Error).message}</p>
        )}
        {mutation.isSuccess && (
          <p className="text-xs text-green-400">Saved successfully</p>
        )}
        {!mutation.isError && !mutation.isSuccess && <span />}
        <button
          type="button"
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Saving…' : 'Save Standards Config'}
        </button>
      </div>
    </div>
  )
}
