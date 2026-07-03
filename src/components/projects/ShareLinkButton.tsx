'use client'
// ============================================================
// ShareLinkButton — opens a modal to manage & copy share links
// ============================================================
import { useState } from 'react'
import { Share2, Copy, Check, Plus, X, Trash2 } from 'lucide-react'
import {
  useShareLinks,
  useCreateShareLink,
  useDeleteShareLink,
  type ShareLink,
} from '@/hooks/useShareLinks'

export function ShareLinkButton({ projectId }: { projectId: string }) {
  const [open, setOpen]       = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [copied, setCopied]   = useState<string | null>(null)

  const { data: links = [], isLoading } = useShareLinks()
  const createLink = useCreateShareLink()
  const deleteLink = useDeleteShareLink()

  // Filter to this project's links
  const projectLinks = (links as ShareLink[]).filter(
    l => l.project_id === projectId
  )

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/share/${token}`
    void navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCreate = () => {
    if (!newLabel.trim()) return
    createLink.mutate(
      { label: newLabel.trim(), projectId },
      { onSuccess: () => setNewLabel('') }
    )
  }

  const handleDelete = (id: string) => {
    deleteLink.mutate(id)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-medium text-surface-200 hover:bg-surface-700 transition-colors"
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl border border-surface-700 bg-surface-900 p-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-surface-50">Client Share Links</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-surface-800 text-surface-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Existing links */}
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
              {isLoading && (
                <p className="text-sm text-surface-500 text-center py-4">Loading…</p>
              )}
              {!isLoading && projectLinks.length === 0 && (
                <p className="text-sm text-surface-500 text-center py-4">No share links yet</p>
              )}
              {projectLinks.map(link => (
                <div
                  key={link.id}
                  className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-surface-200 truncate">
                      {link.label}
                    </div>
                    <div className="text-xs text-surface-500 truncate">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/share/${link.token}`
                        : `/share/${link.token}`}
                    </div>
                    {link.expires_at && (
                      <div className="text-xs text-surface-600 mt-0.5">
                        Expires {new Date(link.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(link.token)}
                    className="shrink-0 rounded p-1.5 hover:bg-surface-700 text-surface-400"
                    title="Copy link"
                  >
                    {copied === link.token
                      ? <Check className="h-4 w-4 text-green-400" />
                      : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    disabled={deleteLink.isPending}
                    className="shrink-0 rounded p-1.5 hover:bg-surface-700 text-surface-500 hover:text-red-400 disabled:opacity-50"
                    title="Delete link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Create new */}
            <div className="flex gap-2">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Label (e.g. Client Review)"
                className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleCreate}
                disabled={createLink.isPending || !newLabel.trim()}
                className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                title="Create link"
              >
                {createLink.isPending
                  ? <span className="text-xs">…</span>
                  : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {createLink.isError && (
              <p className="mt-2 text-xs text-red-400">
                {(createLink.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
