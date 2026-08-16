'use client'
// ============================================================
// ERP Integration Settings
// Lists connected ERP systems, tests connections, adds new
// connectors, and shows sync status.
// ============================================================
import { useState, useEffect } from 'react'
import {
  Link2,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { cn, formatDate } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────

type ErpType = 'MIE_TRAK' | 'SYSPRO' | 'DIGIT' | 'JOBBOSS' | 'GENERIC'
type TestStatus = 'CONNECTED' | 'FAILED' | 'NOT_TESTED'
type AuthMethod = 'API_KEY' | 'BASIC' | 'OAUTH2' | 'NONE'

interface ErpConnector {
  id: string
  erp_type: ErpType
  display_name: string
  erp_host: string
  erp_api_url: string
  auth_method: AuthMethod
  test_status: TestStatus
  last_tested_at: string | null
  last_sync_at: string | null
  created_at: string
}

interface SyncStatus {
  last_sync_at: string | null
  next_sync_at: string | null
  records_synced: number
  errors: number
  status: 'idle' | 'running' | 'error'
}

const ERP_TYPES: { value: ErpType; label: string }[] = [
  { value: 'MIE_TRAK', label: 'MIE Trak Pro' },
  { value: 'SYSPRO',   label: 'SYSPRO' },
  { value: 'DIGIT',    label: 'DIGIT' },
  { value: 'JOBBOSS',  label: 'JobBoss' },
  { value: 'GENERIC',  label: 'Generic / Other' },
]

const AUTH_METHODS: { value: AuthMethod; label: string }[] = [
  { value: 'API_KEY', label: 'API Key' },
  { value: 'BASIC',   label: 'Basic Auth' },
  { value: 'OAUTH2',  label: 'OAuth 2.0' },
  { value: 'NONE',    label: 'None' },
]

// ── Helpers ────────────────────────────────────────────────────

function TestStatusBadge({ status }: { status: TestStatus }) {
  const map = {
    CONNECTED:  { cls: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Connected' },
    FAILED:     { cls: 'bg-red-500/15 text-red-400 border-red-500/30',       label: 'Failed' },
    NOT_TESTED: { cls: 'bg-surface-700 text-surface-400 border-surface-600',  label: 'Not Tested' },
  }
  const { cls, label } = map[status]
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>{label}</span>
  )
}

function Section({ icon: Icon, title, children }: {
  icon:     React.ElementType
  title:    string
  children: React.ReactNode
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-surface-700/60">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-400" />
        </div>
        <h2 className="text-base font-semibold text-surface-100">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Add ERP Modal ──────────────────────────────────────────────

interface AddErpModalProps {
  onClose: () => void
  onAdded: () => void
}

function AddErpModal({ onClose, onAdded }: AddErpModalProps) {
  const [erpType,      setErpType]      = useState<ErpType>('GENERIC')
  const [displayName,  setDisplayName]  = useState('')
  const [erpHost,      setErpHost]      = useState('')
  const [erpApiUrl,    setErpApiUrl]    = useState('')
  const [authMethod,   setAuthMethod]   = useState<AuthMethod>('API_KEY')
  const [apiKey,       setApiKey]       = useState('')
  const [showKey,      setShowKey]      = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/erp/connectors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          erp_type:    erpType,
          display_name: displayName,
          erp_host:    erpHost,
          erp_api_url: erpApiUrl,
          auth_method: authMethod,
          api_key:     apiKey || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      onAdded()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-surface-700">
          <h2 className="text-lg font-bold text-surface-50 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-brand-400" />
            Add ERP Connector
          </h2>
          <button onClick={onClose} className="p-2 text-surface-500 hover:text-surface-200 hover:bg-surface-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ERP Type */}
          <div>
            <label className="label">ERP Type *</label>
            <div className="relative mt-1">
              <select
                value={erpType}
                onChange={e => setErpType(e.target.value as ErpType)}
                required
                className="input appearance-none pr-10"
              >
                {ERP_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="label">Display Name *</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              placeholder="e.g. Production MIE Trak"
              className="input mt-1"
            />
          </div>

          {/* ERP Host */}
          <div>
            <label className="label">ERP Host *</label>
            <input
              value={erpHost}
              onChange={e => setErpHost(e.target.value)}
              required
              placeholder="erp.yourcompany.com"
              className="input mt-1"
            />
          </div>

          {/* ERP API URL */}
          <div>
            <label className="label">ERP API URL</label>
            <input
              value={erpApiUrl}
              onChange={e => setErpApiUrl(e.target.value)}
              placeholder="https://erp.yourcompany.com/api/v1"
              className="input mt-1"
            />
          </div>

          {/* Auth Method */}
          <div>
            <label className="label">Auth Method</label>
            <div className="relative mt-1">
              <select
                value={authMethod}
                onChange={e => setAuthMethod(e.target.value as AuthMethod)}
                className="input appearance-none pr-10"
              >
                {AUTH_METHODS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
            </div>
          </div>

          {/* API Key */}
          {authMethod === 'API_KEY' && (
            <div>
              <label className="label">API Key</label>
              <div className="relative mt-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-…"
                  className="input pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-surface-700">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Add Connector
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function ErpSettingsPage() {
  const [connectors,   setConnectors]   = useState<ErpConnector[]>([])
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [testingId,    setTestingId]    = useState<string | null>(null)
  const [testResults,  setTestResults]  = useState<Record<string, 'CONNECTED' | 'FAILED'>>({})

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [connRes, syncRes] = await Promise.all([
        apiFetch('/api/erp/connectors'),
        apiFetch('/api/erp/sync-status'),
      ])
      if (connRes.ok) setConnectors(await connRes.json() as ErpConnector[])
      if (syncRes.ok) setSyncStatus(await syncRes.json() as SyncStatus)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  async function testConnection(id: string) {
    setTestingId(id)
    try {
      const res = await apiFetch(`/api/erp/connectors/${id}/test`, { method: 'POST' })
      const status: 'CONNECTED' | 'FAILED' = res.ok ? 'CONNECTED' : 'FAILED'
      setTestResults(prev => ({ ...prev, [id]: status }))
      // Update connector in list
      setConnectors(prev => prev.map(c => c.id === id ? { ...c, test_status: status, last_tested_at: new Date().toISOString() } : c))
    } catch {
      setTestResults(prev => ({ ...prev, [id]: 'FAILED' }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">ERP Integration</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Connect PipeField OS to your ERP systems for data sync
        </p>
      </div>

      {/* Connectors section */}
      <Section icon={Link2} title="Connected ERP Systems">
        <div className="space-y-4">
          {/* Add button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New ERP
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-surface-500 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading connectors…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!loading && connectors.length === 0 && (
            <div className="text-center py-10 border border-dashed border-surface-700 rounded-xl">
              <Link2 className="w-8 h-8 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400 text-sm font-medium">No ERP connectors configured</p>
              <p className="text-surface-600 text-xs mt-1">Click "Add New ERP" to connect your first ERP system.</p>
            </div>
          )}

          {!loading && connectors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">ERP</th>
                    <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Host</th>
                    <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Last Sync</th>
                    <th className="text-left py-2 px-3 text-xs text-surface-500 font-semibold uppercase tracking-wide">Status</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {connectors.map(c => {
                    const effectiveStatus = testResults[c.id] ?? c.test_status
                    const isTesting = testingId === c.id
                    const erpLabel = ERP_TYPES.find(t => t.value === c.erp_type)?.label ?? c.erp_type
                    return (
                      <tr key={c.id} className="hover:bg-surface-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-medium text-surface-100">{c.display_name}</p>
                          <p className="text-xs text-surface-500 mt-0.5">{erpLabel}</p>
                        </td>
                        <td className="py-3 px-3 text-surface-400 font-mono text-xs">{c.erp_host}</td>
                        <td className="py-3 px-3 text-surface-500 text-xs">
                          {c.last_sync_at ? formatDate(c.last_sync_at) : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <TestStatusBadge status={effectiveStatus as TestStatus} />
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => void testConnection(c.id)}
                            disabled={isTesting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-surface-100 transition-colors disabled:opacity-50"
                          >
                            {isTesting
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RefreshCw className="w-3.5 h-3.5" />
                            }
                            Test
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Sync Status */}
      <Section icon={RefreshCw} title="Sync Status">
        {syncStatus ? (
          <div className="space-y-4">
            {/* Status indicator */}
            <div className={cn(
              'flex items-center gap-3 p-4 rounded-xl border',
              syncStatus.status === 'running' ? 'bg-brand-500/10 border-brand-500/30' :
              syncStatus.status === 'error'   ? 'bg-red-500/10 border-red-500/30' :
                                                'bg-surface-800/60 border-surface-700'
            )}>
              {syncStatus.status === 'running' && <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />}
              {syncStatus.status === 'error'   && <XCircle className="w-5 h-5 text-red-400" />}
              {syncStatus.status === 'idle'    && <CheckCircle2 className="w-5 h-5 text-green-400" />}
              <div>
                <p className="text-sm font-semibold text-surface-100 capitalize">{syncStatus.status}</p>
                <p className="text-xs text-surface-500">
                  {syncStatus.status === 'running' ? 'Sync in progress…' :
                   syncStatus.status === 'error'   ? 'Last sync encountered errors' :
                                                     'System is idle'}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Records Synced', value: syncStatus.records_synced },
                { label: 'Errors',         value: syncStatus.errors },
                { label: 'Last Sync',      value: syncStatus.last_sync_at ? formatDate(syncStatus.last_sync_at) : '—' },
              ].map(s => (
                <div key={s.label} className="bg-surface-800/60 rounded-xl p-4 border border-surface-700/50 text-center">
                  <p className={cn('text-2xl font-bold', s.label === 'Errors' && Number(s.value) > 0 ? 'text-red-400' : 'text-surface-50')}>
                    {s.value}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {syncStatus.next_sync_at && (
              <p className="text-xs text-surface-500">
                Next scheduled sync: {formatDate(syncStatus.next_sync_at)}
              </p>
            )}
          </div>
        ) : !loading ? (
          <p className="text-sm text-surface-500 py-4 text-center">
            No sync status available. Add and test an ERP connector to begin syncing.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-surface-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading sync status…
          </div>
        )}
      </Section>

      {/* Modal */}
      {showAdd && (
        <AddErpModal
          onClose={() => setShowAdd(false)}
          onAdded={() => void loadData()}
        />
      )}
    </div>
  )
}
