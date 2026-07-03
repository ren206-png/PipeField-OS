// ============================================================
// Header — Top bar inside the dashboard
// Live notifications bell + global search (Cmd+K)
// ============================================================
'use client'

import { useState } from 'react'
import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { getInitials } from '@/lib/utils'
import { USER_ROLE_LABELS } from '@/types'
import { NotificationPanel } from './NotificationPanel'
import { GlobalSearch } from './GlobalSearch'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { profile } = useAuth()
  const { unreadCount } = useNotifications()
  const [showNotifications, setShowNotifications] = useState(false)

  const hasAlerts = unreadCount > 0

  return (
    <>
      <GlobalSearch />

      <header className="sticky top-0 z-30 bg-surface-900/80 backdrop-blur-md border-b border-surface-800">
        <div className="flex items-center gap-4 px-4 sm:px-6 lg:px-8 h-16">
          {/* Page title (shown on mobile) */}
          {title && (
            <div className="flex-1 min-w-0 lg:hidden">
              <h1 className="text-lg font-bold text-surface-50 truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-surface-500 truncate">{subtitle}</p>
              )}
            </div>
          )}

          {/* Spacer on desktop */}
          <div className="hidden lg:block flex-1" />

          {/* Right actions cluster */}
          <div className="flex items-center gap-2">
            {actions}

            {/* Search button — opens Cmd+K palette */}
            <button
              onClick={() => {
                // Dispatch a synthetic keydown to trigger GlobalSearch
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
              }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 border border-surface-700 hover:bg-surface-700 transition-colors text-surface-500 hover:text-surface-300"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="hidden md:inline text-[10px] font-mono text-surface-600 bg-surface-900 px-1 py-0.5 rounded border border-surface-700">⌘K</kbd>
            </button>

            {/* Mobile search */}
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
              }}
              className="sm:hidden p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(s => !s)}
                className={cn(
                  'relative p-2 rounded-lg transition-colors',
                  showNotifications
                    ? 'bg-surface-700 text-surface-100'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-700/50'
                )}
                aria-label={`Notifications${hasAlerts ? ` — ${unreadCount} unread` : ''}`}
              >
                <Bell className="w-4 h-4" />
                {hasAlerts && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-surface-900 bg-red-500" />
                )}
              </button>

              {showNotifications && (
                <NotificationPanel onClose={() => setShowNotifications(false)} />
              )}
            </div>

            {/* User avatar */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-surface-700">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-brand-400">
                  {profile ? getInitials(profile.full_name) : '?'}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-surface-200 leading-none">
                  {profile?.full_name?.split(' ')[0] ?? 'User'}
                </p>
                <p className="text-xs text-surface-500 leading-none mt-0.5">
                  {profile ? USER_ROLE_LABELS[profile.role] : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
