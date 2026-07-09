'use client'
import { useState } from 'react'
import { X, Copy, Check, Mail } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

const ROLES = [
  { value: 'administrator',   label: 'Administrator' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'foreman',         label: 'Foreman' },
  { value: 'qa_inspector',    label: 'QA/QC Inspector' },
  { value: 'shop_fabricator', label: 'Shop Fabricator' },
  { value: 'pipefitter',      label: 'Pipefitter' },
  { value: 'client_viewer',   label: 'Client Viewer' },
]

interface Props {
  onClose:   () => void
  onSuccess: () => void
}

export function InviteWorkerModal({ onClose, onSuccess }: Props) {
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState('pipefitter')
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)

    const res = await apiFetch('/api/organization/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, role }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to send invite')
      setSending(false)
      return
    }

    setInviteUrl(data.invite_url)
    setSending(false)
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-sm p-6 space-y-5">

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-surface-50">Invite Team Member</h3>
          <button onClick={onClose} aria-label="Close" className="text-surface-500 hover:text-surface-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {inviteUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-center space-y-1">
              <p className="text-sm font-medium text-green-300">Invite sent!</p>
              <p className="text-xs text-surface-400">
                An email has been sent to <strong className="text-surface-200">{email}</strong>.
                You can also share the link below directly.
              </p>
            </div>

            <div>
              <label className="label">Invite Link</label>
              <div className="flex gap-2">
                <input
                  value={inviteUrl}
                  readOnly
                  className="input flex-1 text-xs text-surface-400"
                />
                <button
                  onClick={copyLink}
                  className="btn-ghost px-3 flex items-center gap-1.5 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setInviteUrl(null); setEmail(''); setRole('pipefitter') }} className="btn-ghost text-sm">
                Invite another
              </button>
              <button onClick={() => { onSuccess(); onClose() }} className="btn-primary text-sm">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="worker@company.com"
                className="input w-full"
              />
            </div>

            <div>
              <label className="label">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="input w-full">
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-xs text-surface-600 mt-1">
                The worker will be assigned this role when they accept the invite.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button type="submit" disabled={sending || !email} className="btn-primary text-sm flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {sending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
