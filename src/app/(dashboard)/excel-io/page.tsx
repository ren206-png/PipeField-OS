'use client'
// ============================================================
// Excel I/O — Export and import Weld Log, Welder Roster, MTR Index
// ============================================================
import { useState, useRef, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileSpreadsheet, Download, Upload, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/apiFetch'
import { useProjectsList } from '@/hooks/useProjects'

// ── Types ────────────────────────────────────────────────────

type Tab = 'weld-log' | 'welder-roster' | 'mtr-index'

interface ValidationError {
  row:     number
  field:   string
  message: string
}

interface DryRunResult {
  valid_count: number
  error_count: number
  errors:      ValidationError[]
  preview:     Record<string, string>[]
}

interface ImportResult {
  inserted: number
  updated:  number
}

// ── Toast ────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border',
      type === 'success'
        ? 'bg-green-500/10 text-green-300 border-green-500/20'
        : 'bg-red-500/10 text-red-300 border-red-500/20'
    )}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ── Weld Log Tab ─────────────────────────────────────────────

function WeldLogTab() {
  const { data: projects = [] } = useProjectsList()
  const [exportProjectId, setExportProjectId] = useState('')
  const [importProjectId, setImportProjectId] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: async (isDryRun: boolean): Promise<DryRunResult | ImportResult> => {
      if (!file || !importProjectId) throw new Error('File and project are required')
      const fd = new FormData()
      fd.append('file',       file)
      fd.append('project_id', importProjectId)
      fd.append('dry_run',    String(isDryRun))
      const res = await apiFetch('/api/excel/import/weld-log', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { message?: string }).message ?? 'Upload failed')
      }
      return res.json() as Promise<DryRunResult | ImportResult>
    },
    onSuccess: (data, isDryRun) => {
      if (isDryRun) {
        setDryRunResult(data as DryRunResult)
      } else {
        const r = data as ImportResult
        setToast({ message: `Import complete: ${r.inserted} records processed.`, type: 'success' })
        setDryRunResult(null)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    onError: (err: Error) => setToast({ message: err.message, type: 'error' }),
  })

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">Export Weld Log</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={exportProjectId}
            onChange={e => setExportProjectId(e.target.value)}
          >
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            disabled={!exportProjectId}
            onClick={() => {
              window.location.href = `/api/excel/export/weld-log?project_id=${exportProjectId}`
            }}
          >
            <Download className="w-4 h-4" />
            Download Excel
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">Import Weld Log</h3>

        {/* Amber dry-run banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Dry run is required before import. All imports are validated before committing to database.</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={importProjectId}
            onChange={e => setImportProjectId(e.target.value)}
          >
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="flex-1 text-sm text-surface-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-surface-700 file:text-surface-200 hover:file:bg-surface-600 file:cursor-pointer"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setFile(e.target.files?.[0] ?? null)
              setDryRunResult(null)
            }}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          Dry run (validate without committing)
        </label>

        <button
          className="btn-primary flex items-center gap-2"
          disabled={!file || !importProjectId || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate(dryRun)}
        >
          <Upload className="w-4 h-4" />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload & Validate'}
        </button>

        {dryRunResult && <DryRunSummary result={dryRunResult} onConfirm={() => uploadMutation.mutate(false)} confirming={uploadMutation.isPending} />}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}

// ── Welder Roster Tab ─────────────────────────────────────────

function WelderRosterTab() {
  const [dryRun, setDryRun] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: async (isDryRun: boolean): Promise<DryRunResult | ImportResult> => {
      if (!file) throw new Error('File is required')
      const fd = new FormData()
      fd.append('file',    file)
      fd.append('dry_run', String(isDryRun))
      const res = await apiFetch('/api/excel/import/welder-roster', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { message?: string }).message ?? 'Upload failed')
      }
      return res.json() as Promise<DryRunResult | ImportResult>
    },
    onSuccess: (data, isDryRun) => {
      if (isDryRun) {
        setDryRunResult(data as DryRunResult)
      } else {
        const r = data as ImportResult
        setToast({ message: `Import complete: ${r.inserted} records processed.`, type: 'success' })
        setDryRunResult(null)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    onError: (err: Error) => setToast({ message: err.message, type: 'error' }),
  })

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">Export Welder Roster</h3>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { window.location.href = '/api/excel/export/welder-roster' }}
        >
          <Download className="w-4 h-4" />
          Download Excel
        </button>
      </div>

      {/* Import */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">Import Welder Roster</h3>

        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Dry run is required before import. All imports are validated before committing to database.</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="text-sm text-surface-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-surface-700 file:text-surface-200 hover:file:bg-surface-600 file:cursor-pointer"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setFile(e.target.files?.[0] ?? null)
            setDryRunResult(null)
          }}
        />

        <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          Dry run (validate without committing)
        </label>

        <button
          className="btn-primary flex items-center gap-2"
          disabled={!file || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate(dryRun)}
        >
          <Upload className="w-4 h-4" />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload & Validate'}
        </button>

        {dryRunResult && <DryRunSummary result={dryRunResult} onConfirm={() => uploadMutation.mutate(false)} confirming={uploadMutation.isPending} />}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}

// ── MTR Index Tab ─────────────────────────────────────────────

function MtrIndexTab() {
  const [dryRun, setDryRun] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: async (isDryRun: boolean): Promise<DryRunResult | ImportResult> => {
      if (!file) throw new Error('File is required')
      const fd = new FormData()
      fd.append('file',    file)
      fd.append('dry_run', String(isDryRun))
      const res = await apiFetch('/api/excel/import/mtr-index', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { message?: string }).message ?? 'Upload failed')
      }
      return res.json() as Promise<DryRunResult | ImportResult>
    },
    onSuccess: (data, isDryRun) => {
      if (isDryRun) {
        setDryRunResult(data as DryRunResult)
      } else {
        const r = data as ImportResult
        setToast({ message: `Import complete: ${r.inserted} records processed.`, type: 'success' })
        setDryRunResult(null)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    onError: (err: Error) => setToast({ message: err.message, type: 'error' }),
  })

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">Export MTR Index</h3>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { window.location.href = '/api/excel/export/mtr-index' }}
        >
          <Download className="w-4 h-4" />
          Download Excel
        </button>
      </div>

      {/* Import */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">Import MTR Index</h3>

        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Dry run is required before import. All imports are validated before committing to database.</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="text-sm text-surface-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-surface-700 file:text-surface-200 hover:file:bg-surface-600 file:cursor-pointer"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setFile(e.target.files?.[0] ?? null)
            setDryRunResult(null)
          }}
        />

        <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          Dry run (validate without committing)
        </label>

        <button
          className="btn-primary flex items-center gap-2"
          disabled={!file || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate(dryRun)}
        >
          <Upload className="w-4 h-4" />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload & Validate'}
        </button>

        {dryRunResult && <DryRunSummary result={dryRunResult} onConfirm={() => uploadMutation.mutate(false)} confirming={uploadMutation.isPending} />}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}

// ── Dry Run Summary ───────────────────────────────────────────

function DryRunSummary({
  result,
  onConfirm,
  confirming,
}: {
  result:     DryRunResult
  onConfirm:  () => void
  confirming: boolean
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-sm">
          <CheckCircle className="w-4 h-4" />
          {result.valid_count} valid
        </div>
        {result.error_count > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {result.error_count} rows with errors
          </div>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-lg overflow-hidden border border-surface-700">
          <table className="w-full text-sm">
            <thead className="bg-surface-800">
              <tr>
                <th className="text-left px-3 py-2 text-surface-400 font-medium">Row</th>
                <th className="text-left px-3 py-2 text-surface-400 font-medium">Field</th>
                <th className="text-left px-3 py-2 text-surface-400 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {result.errors.map((e, i) => (
                <tr key={i} className="bg-surface-900">
                  <td className="px-3 py-2 text-surface-300">{e.row}</td>
                  <td className="px-3 py-2 text-surface-300">{e.field}</td>
                  <td className="px-3 py-2 text-red-400">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.error_count === 0 && (
        <button
          className="btn-primary flex items-center gap-2"
          disabled={confirming}
          onClick={onConfirm}
        >
          <CheckCircle className="w-4 h-4" />
          {confirming ? 'Importing…' : 'Confirm Import'}
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'weld-log',      label: 'Weld Log'      },
  { id: 'welder-roster', label: 'Welder Roster'  },
  { id: 'mtr-index',     label: 'MTR Index'      },
]

export default function ExcelIOPage() {
  const [activeTab, setActiveTab] = useState<Tab>('weld-log')

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-500/15 rounded-xl flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-50">Excel I/O</h1>
          <p className="text-sm text-surface-400">Export and import field data via Excel spreadsheets</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-xl p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-surface-700 text-surface-100 shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'weld-log'      && <WeldLogTab />}
      {activeTab === 'welder-roster' && <WelderRosterTab />}
      {activeTab === 'mtr-index'     && <MtrIndexTab />}
    </div>
  )
}
