'use client'
// ============================================================
// Field Mode Home — 4-tile dashboard
// Tile list is typed as a 4-tuple: TypeScript rejects a 5th element
// at compile time, enforcing the "exactly four tiles" rule.
// ============================================================
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { FLAGS } from '@/intelligence/flags'
import { useFieldStrings } from '@/lib/field-mode/locale'
import { getPendingFieldWelds } from '@/lib/offline-queue'
import type { FieldWeldQueueItem } from '@/lib/offline-queue'

// ── Icons (inline SVG — no external icon lib dependency) ─────
function CalendarIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-12 h-12">
      <rect x="6" y="10" width="36" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <line x1="6" y1="18" x2="42" y2="18" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="16" y1="6" x2="16" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="32" y1="6" x2="32" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <rect x="14" y="24" width="6" height="6" rx="1" fill="currentColor"/>
      <rect x="28" y="24" width="6" height="6" rx="1" fill="currentColor"/>
    </svg>
  )
}

function CalculatorIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-12 h-12">
      <rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <rect x="14" y="10" width="20" height="8" rx="2" fill="currentColor" opacity="0.6"/>
      <rect x="13" y="24" width="5" height="5" rx="1" fill="currentColor"/>
      <rect x="21.5" y="24" width="5" height="5" rx="1" fill="currentColor"/>
      <rect x="30" y="24" width="5" height="5" rx="1" fill="currentColor"/>
      <rect x="13" y="33" width="5" height="5" rx="1" fill="currentColor"/>
      <rect x="21.5" y="33" width="5" height="5" rx="1" fill="currentColor"/>
      <rect x="30" y="33" width="5" height="10" rx="1" fill="currentColor"/>
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-12 h-12">
      <path d="M8 8C8 8 14 6 24 8V42C14 40 8 42 8 42V8Z" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <path d="M40 8C40 8 34 6 24 8V42C34 40 40 42 40 42V8Z" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <line x1="28" y1="14" x2="36" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="28" y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="28" y1="26" x2="36" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function LogIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-12 h-12">
      <rect x="8" y="6" width="32" height="38" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <circle cx="24" cy="16" r="7" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M12 36C12 30.477 17.373 26 24 26C30.627 26 36 30.477 36 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

// ── Tile type ─────────────────────────────────────────────────
interface Tile {
  id: 'today' | 'calc' | 'book' | 'log'
  label: string
  href: string
  icon: React.ReactNode
  enabled: boolean
}

// ── Sync state ────────────────────────────────────────────────
type SyncState = 'synced' | 'queued' | 'failed'

export default function FieldHomePage() {
  const t = useFieldStrings('en')
  const [syncState, setSyncState] = useState<SyncState>('synced')
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  useEffect(() => {
    async function checkSync() {
      try {
        const items: FieldWeldQueueItem[] = await getPendingFieldWelds()
        const failed = items.filter(i => i.sync_status === 'failed').length
        const pending = items.filter(i => i.sync_status === 'pending').length
        setFailedCount(failed)
        setPendingCount(pending)
        if (failed > 0) {
          setSyncState('failed')
        } else if (pending > 0) {
          setSyncState('queued')
        } else {
          setSyncState('synced')
        }
      } catch {
        // IndexedDB unavailable in SSR or unsupported — ignore
      }
    }
    checkSync()
  }, [])

  // ── Tiles — typed 4-tuple. TypeScript will reject a 5th element. ──
  const TILES: [Tile, Tile, Tile, Tile] = [
    {
      id: 'today',
      label: t.home_today,
      href: '/field/today',
      icon: <CalendarIcon />,
      enabled: true,
    },
    {
      id: 'calc',
      label: t.home_calc,
      href: '/field/calc',
      icon: <CalculatorIcon />,
      enabled: FLAGS.PFOS_FIELD_CALC,
    },
    {
      id: 'book',
      label: t.home_book,
      href: '/field/book',
      icon: <BookIcon />,
      enabled: FLAGS.PFOS_FIELD_REFERENCE,
    },
    {
      id: 'log',
      label: t.home_my_log,
      href: '/field/log',
      icon: <LogIcon />,
      enabled: FLAGS.PFOS_FIELD_PERSONAL_LOG,
    },
  ]

  // ── Sync indicator ────────────────────────────────────────────
  function SyncIndicator() {
    const syncHref = syncState !== 'synced' ? '/field/sync' : undefined

    const indicator = (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
          syncState === 'synced' ? 'bg-green-900/40 text-green-300' :
          syncState === 'queued' ? 'bg-amber-900/40 text-amber-300' :
          'bg-red-900/40 text-red-300'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            syncState === 'synced' ? 'bg-green-400' :
            syncState === 'queued' ? 'bg-amber-400' :
            'bg-red-400'
          }`}
          aria-hidden="true"
        />
        {syncState === 'synced' && t.home_sync_synced}
        {syncState === 'queued' && t.home_sync_queued(pendingCount)}
        {syncState === 'failed' && t.home_sync_failed}
      </div>
    )

    if (syncHref) {
      return (
        <Link href={syncHref} className="min-h-[56px] min-w-[56px] flex items-center">
          {indicator}
        </Link>
      )
    }
    return indicator
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Sync state — fixed at top */}
      <div className="fixed top-0 left-0 right-0 z-10 flex justify-end px-4 pt-safe pt-4 pb-2 bg-surface-950/80 backdrop-blur-sm">
        <SyncIndicator />
      </div>

      {/* Tiles — centered in bottom 60% of viewport */}
      {/* pt-[40vh] pushes the grid into the bottom 60% */}
      <main className="flex-1 flex items-start justify-center pt-[40vh] px-4 pb-8">
        <div
          className="grid grid-cols-2 gap-4 w-full max-w-sm"
          role="navigation"
          aria-label="Field Mode navigation"
        >
          {TILES.map((tile) => {
            const disabled = !tile.enabled
            const content = (
              <div
                className={`
                  flex flex-col items-center justify-center gap-3
                  min-h-[56px] min-w-[56px] aspect-square
                  rounded-2xl border p-6
                  transition-colors duration-150
                  ${disabled
                    ? 'bg-surface-900/40 border-surface-800/40 text-surface-600 opacity-50 cursor-not-allowed'
                    : 'bg-surface-900 border-surface-700 text-surface-100 active:bg-surface-800'
                  }
                `}
              >
                <span className={disabled ? 'text-surface-600' : 'text-surface-200'}>
                  {tile.icon}
                </span>
                <span className="text-sm font-semibold tracking-wide">{tile.label}</span>
              </div>
            )

            if (disabled) {
              return (
                <div
                  key={tile.id}
                  aria-disabled="true"
                  role="button"
                  aria-label={`${tile.label} (unavailable)`}
                >
                  {content}
                </div>
              )
            }

            return (
              <Link
                key={tile.id}
                href={tile.href}
                className="block"
                aria-label={tile.label}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
