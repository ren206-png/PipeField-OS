'use client'
import { useState } from 'react'
import { Plus, Award } from 'lucide-react'
import { useWelderCerts, useAddWelderCert } from '@/hooks/useWelderCerts'

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

export function WelderCertsList({ welderId }: { welderId: string }) {
  const { data: certs = [], isLoading } = useWelderCerts(welderId)
  const addCert = useAddWelderCert()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    cert_type: '',
    cert_number: '',
    expiry_date: '',
    issued_date: '',
    issued_by: '',
  })

  const handleAdd = () => {
    if (!form.cert_type || !form.expiry_date) return
    addCert.mutate({
      welder_id: welderId,
      ...form,
      cert_processes: null,
      cert_positions: null,
      notes: null,
    })
    setShowForm(false)
    setForm({ cert_type: '', cert_number: '', expiry_date: '', issued_date: '', issued_by: '' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-200">Certifications</h3>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Cert
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-surface-500">Loading…</p>
      ) : certs.length === 0 ? (
        <p className="text-sm text-surface-500">No certifications on file</p>
      ) : (
        <div className="space-y-2">
          {certs.map(cert => {
            const days = daysUntil(cert.expiry_date)
            const status = days < 0 ? 'expired' : days <= 7 ? 'critical' : days <= 30 ? 'warning' : 'valid'
            return (
              <div key={cert.id} className="rounded-xl border border-surface-700 bg-surface-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-brand-400" />
                    <span className="text-sm font-semibold text-surface-200">{cert.cert_type}</span>
                    {cert.cert_number && <span className="text-xs text-surface-500">#{cert.cert_number}</span>}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    status === 'expired' ? 'bg-danger/15 text-danger' :
                    status === 'critical' ? 'bg-danger/15 text-danger' :
                    status === 'warning' ? 'bg-warning/15 text-warning' :
                    'bg-success/15 text-success'
                  }`}>
                    {status === 'expired' ? 'Expired' :
                     status === 'critical' ? `${days}d left` :
                     status === 'warning' ? `${days}d left` :
                     'Valid'}
                  </span>
                </div>
                <div className="text-xs text-surface-500">
                  Expires: {new Date(cert.expiry_date).toLocaleDateString('en-CA')}
                  {cert.issued_by && ` · Issued by: ${cert.issued_by}`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-brand-500/30 bg-surface-800 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-surface-200">Add Certification</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Type *</label>
              <input value={form.cert_type} onChange={e => setForm(f => ({ ...f, cert_type: e.target.value }))}
                placeholder="e.g. CWB, AWS D1.1" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Cert #</label>
              <input value={form.cert_number} onChange={e => setForm(f => ({ ...f, cert_number: e.target.value }))}
                placeholder="Certificate number" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Expiry Date *</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1">Issued By</label>
              <input value={form.issued_by} onChange={e => setForm(f => ({ ...f, issued_by: e.target.value }))}
                placeholder="e.g. CWB Group" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-50 focus:outline-none focus:border-brand-500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-surface-700 px-3 py-2 text-xs font-medium text-surface-300 hover:bg-surface-700">Cancel</button>
            <button onClick={handleAdd} disabled={addCert.isPending} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {addCert.isPending ? 'Saving…' : 'Add Cert'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
