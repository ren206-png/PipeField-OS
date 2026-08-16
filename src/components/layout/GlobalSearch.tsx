'use client'
// ============================================================
// GlobalSearch — Cmd+K command palette
// Searches welds, spools, projects, RFIs, NCRs, documents
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Search, Flame, Package, FolderKanban, AlertOctagon, FileText, X, ChevronRight, Loader2, Clock, MessageSquareMore, Gauge, FileSearch } from 'lucide-react'
import { getRecent, type RecentItem } from '@/lib/recent'

export { addRecent } from '@/lib/recent'

interface SearchResult {
  id: string
  type: 'weld' | 'spool' | 'project' | 'rfi' | 'ncr' | 'document' | 'pressure_test' | 'mtr'
  title: string
  subtitle: string
  href: string
}

const TYPE_CONFIG = {
  weld:          { icon: Flame,             label: 'Weld',          color: 'text-brand-400'   },
  spool:         { icon: Package,           label: 'Spool',         color: 'text-orange-400'  },
  project:       { icon: FolderKanban,      label: 'Project',       color: 'text-purple-400'  },
  rfi:           { icon: MessageSquareMore, label: 'RFI',           color: 'text-blue-400'    },
  ncr:           { icon: AlertOctagon,      label: 'NCR',           color: 'text-red-400'     },
  document:      { icon: FileText,          label: 'Document',      color: 'text-surface-400' },
  pressure_test: { icon: Gauge,             label: 'Pressure Test', color: 'text-cyan-400'    },
  mtr:           { icon: FileSearch,        label: 'MTR',           color: 'text-emerald-400' },
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { profile } = useAuth()
  const supabaseRef = useRef(createClient())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened, load recent items
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelected(0)
      setRecentItems(getRecent())
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Search
  const search = useCallback(async (q: string) => {
    if (!q.trim() || !profile?.organization_id) {
      setResults([])
      return
    }
    setLoading(true)
    const supabase = supabaseRef.current
    try {
      const orgId = profile.organization_id
      const term = q.trim()

      const [weldsR, spoolsR, projectsR, rfisR, ncrsR, docsR, pressureTestsR, mtrsR] = await Promise.all([
        supabase.from('welds').select('id, weld_id_number, status, welder_name').eq('organization_id', orgId).ilike('weld_id_number', `%${term}%`).limit(5),
        supabase.from('spools').select('id, spool_number, status, line_number').eq('organization_id', orgId).ilike('spool_number', `%${term}%`).limit(5),
        supabase.from('projects').select('id, name, project_number, status').eq('organization_id', orgId).or(`name.ilike.%${term}%,project_number.ilike.%${term}%`).limit(5),
        supabase.from('rfis').select('id, rfi_number, title, status').eq('organization_id', orgId).or(`rfi_number.ilike.%${term}%,title.ilike.%${term}%`).limit(5),
        supabase.from('ncrs').select('id, ncr_number, title, severity').eq('organization_id', orgId).or(`ncr_number.ilike.%${term}%,title.ilike.%${term}%`).limit(5),
        supabase.from('documents').select('id, title, document_type, status').eq('organization_id', orgId).ilike('title', `%${term}%`).limit(5),
        supabase.from('pressure_tests').select('id, test_number, system_name, status').eq('organization_id', orgId).or(`test_number.ilike.%${term}%,system_name.ilike.%${term}%`).limit(3),
        supabase.from('mtrs').select('id, heat_number, material_spec, status').eq('organization_id', orgId).or(`heat_number.ilike.%${term}%,material_spec.ilike.%${term}%`).limit(3),
      ])

      const out: SearchResult[] = [
        ...(weldsR.data ?? []).map((w) => ({
          id: w.id, type: 'weld' as const,
          title: w.weld_id_number,
          subtitle: `${(w.status as string).replace(/_/g, ' ')}${w.welder_name ? ` · ${w.welder_name}` : ''}`,
          href: `/welds/${w.id}`,
        })),
        ...(spoolsR.data ?? []).map((s) => ({
          id: s.id, type: 'spool' as const,
          title: s.spool_number,
          subtitle: `${(s.status as string).replace(/_/g, ' ')}${s.line_number ? ` · ${s.line_number}` : ''}`,
          href: `/spools/${s.id}`,
        })),
        ...(projectsR.data ?? []).map((p) => ({
          id: p.id, type: 'project' as const,
          title: p.name,
          subtitle: `${p.project_number ?? ''} · ${p.status}`,
          href: `/projects/${p.id}`,
        })),
        ...(rfisR.data ?? []).map((r) => ({
          id: r.id, type: 'rfi' as const,
          title: `${r.rfi_number} — ${r.title}`,
          subtitle: r.status as string,
          href: `/documents/rfis/${r.id}`,
        })),
        ...(ncrsR.data ?? []).map((n) => ({
          id: n.id, type: 'ncr' as const,
          title: `${n.ncr_number} — ${n.title}`,
          subtitle: `${n.severity} severity`,
          href: `/documents/ncrs/${n.id}`,
        })),
        ...(docsR.data ?? []).map((d) => ({
          id: d.id, type: 'document' as const,
          title: d.title,
          subtitle: `${d.document_type} · ${d.status}`,
          href: '/documents',
        })),
        ...(pressureTestsR.data ?? []).map((t) => ({
          id: t.id, type: 'pressure_test' as const,
          title: t.test_number,
          subtitle: `${t.system_name}${t.status ? ` · ${(t.status as string).replace(/_/g, ' ')}` : ''}`,
          href: `/documents/pressure-tests/${t.id}`,
        })),
        ...(mtrsR.data ?? []).map((m) => ({
          id: m.id, type: 'mtr' as const,
          title: m.heat_number,
          subtitle: `${m.material_spec}${m.status ? ` · ${(m.status as string).replace(/_/g, ' ')}` : ''}`,
          href: `/documents/mtrs/${m.id}`,
        })),
      ]
      setResults(out)
      setSelected(0)
    } finally {
      setLoading(false)
    }
  }, [profile?.organization_id])

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => search(query), 300)
    } else {
      setResults([])
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Keyboard navigation
  const activeList = query === '' ? recentItems : results
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, activeList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && activeList[selected]) {
      if (query === '') {
        navigateRecent(activeList[selected] as RecentItem)
      } else {
        navigate(activeList[selected] as SearchResult)
      }
    }
  }

  function navigate(r: SearchResult) {
    router.push(r.href)
    setOpen(false)
  }

  function navigateRecent(r: RecentItem) {
    router.push(r.href)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Logo bar */}
        <div className="flex items-center justify-center py-3 border-b border-surface-800/60 bg-surface-900/60">
          <img src="/logo.png" alt="PipeField OS" className="h-7 w-auto" />
        </div>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-800">
          {loading ? (
            <Loader2 className="w-4 h-4 text-surface-500 flex-shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-surface-500 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-surface-100 placeholder-surface-500 text-sm outline-none"
            placeholder="Search welds, spools, projects, RFIs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-surface-600 hover:text-surface-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-800 text-surface-500 text-[10px] font-mono border border-surface-700">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query === '' ? (
            recentItems.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 text-surface-700 mx-auto mb-2" />
                <p className="text-sm text-surface-500">Type at least 2 characters to search</p>
                <p className="text-xs text-surface-600 mt-1">Searches welds, spools, projects, RFIs, NCRs, documents</p>
              </div>
            ) : (
              <div className="py-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-surface-600 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Recently Viewed
                </p>
                {recentItems.map((r, i) => {
                  const typeKey = r.type as keyof typeof TYPE_CONFIG
                  const cfg = TYPE_CONFIG[typeKey] ?? { icon: FileText, label: r.type, color: 'text-surface-400' }
                  const Icon = cfg.icon
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigateRecent(r)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        i === selected ? 'bg-surface-800' : 'hover:bg-surface-800/50'
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
                        <Icon className={cn('w-4 h-4', cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-100 truncate">{r.label}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded">{cfg.label}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-surface-600" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          ) : query.length < 2 ? (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-surface-700 mx-auto mb-2" />
              <p className="text-sm text-surface-500">Type at least 2 characters to search</p>
              <p className="text-xs text-surface-600 mt-1">Searches welds, spools, projects, RFIs, NCRs, documents</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-surface-500">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="py-1">
              {results.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type]
                const Icon = cfg.icon
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setSelected(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      i === selected ? 'bg-surface-800' : 'hover:bg-surface-800/50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center flex-shrink-0">
                      <Icon className={cn('w-4 h-4', cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-100 truncate">{r.title}</p>
                      <p className="text-xs text-surface-500 truncate">{r.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded">{cfg.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-surface-600" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-surface-800 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-surface-600">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 font-mono">↑↓</kbd>
            Navigate
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-surface-600">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 font-mono">↵</kbd>
            Open
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-surface-600">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 font-mono">Esc</kbd>
            Close
          </div>
        </div>
      </div>
    </div>
  )
}
