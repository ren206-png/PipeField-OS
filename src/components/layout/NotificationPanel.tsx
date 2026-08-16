'use client'
// ============================================================
// NotificationPanel — dropdown from the bell icon in Header
// Rendered as a portal so it escapes overflow-hidden containers
// ============================================================
import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useNotifications, type DbNotification } from '@/hooks/useNotifications'
import { Flame, AlertOctagon, MessageSquareMore, CheckCircle, Bell, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  weld_failed:    { icon: Flame,              color: 'text-red-400',    bg: 'bg-red-500/10'    },
  weld_accepted:  { icon: CheckCircle,        color: 'text-green-400',  bg: 'bg-green-500/10'  },
  ncr_created:    { icon: AlertOctagon,       color: 'text-orange-400', bg: 'bg-orange-500/10' },
  rfi_created:    { icon: MessageSquareMore,  color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  welder_alert:   { icon: Flame,              color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  default:        { icon: Bell,               color: 'text-brand-400',  bg: 'bg-brand-500/10'  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.default
}

function NotificationItem({ n, onMarkRead, onClose }: {
  n: DbNotification
  onMarkRead: (id: string) => void
  onClose: () => void
}) {
  const cfg = getTypeConfig(n.type)
  const Icon = cfg.icon
  const content = (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 hover:bg-surface-800/50 transition-colors border-b border-surface-800/60 last:border-0',
      !n.is_read && 'bg-brand-500/5'
    )}>
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
        <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs font-semibold leading-tight', n.is_read ? 'text-surface-400' : 'text-surface-200')}>{n.title}</p>
        <p className="text-xs text-surface-500 mt-0.5 leading-tight">{n.body}</p>
        <span className="text-[10px] text-surface-600 mt-1 inline-block">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </span>
      </div>
      {!n.is_read && (
        <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
      )}
    </div>
  )

  const handleClick = () => {
    if (!n.is_read) onMarkRead(n.id)
    onClose()
  }

  if (n.href) {
    return <Link href={n.href} onClick={handleClick}>{content}</Link>
  }
  return <button className="w-full text-left" onClick={() => { if (!n.is_read) onMarkRead(n.id) }}>{content}</button>
}

interface NotificationPanelProps {
  onClose: () => void
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, markRead, markAllRead, isLoading } = useNotifications()
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!mounted) return null

  const unread = notifications.filter(n => !n.is_read)
  const read   = notifications.filter(n => n.is_read)

  const panel = (
    <div
      ref={panelRef}
      className="fixed top-16 right-4 w-96 max-h-[80vh] bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[200]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-surface-100">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full font-medium">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-700 rounded-lg transition-colors"
              title="Mark all read"
            >
              <Check className="w-3 h-3" />
              All read
            </button>
          )}
          <button onClick={onClose} aria-label="Close notifications" className="p-1.5 text-surface-500 hover:text-surface-300 rounded-lg hover:bg-surface-700 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-7 h-7 bg-surface-800 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-surface-800 rounded w-3/4" />
                  <div className="h-2.5 bg-surface-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <Bell className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-surface-300">All clear!</p>
            <p className="text-xs text-surface-500 mt-1">No notifications yet</p>
          </div>
        ) : (
          <>
            {unread.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-surface-800/30 border-b border-surface-800">
                  <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Unread</p>
                </div>
                {unread.map(n => <NotificationItem key={n.id} n={n} onMarkRead={markRead} onClose={onClose} />)}
              </div>
            )}
            {read.length > 0 && (
              <div>
                {unread.length > 0 && (
                  <div className="px-4 py-2 bg-surface-800/20 border-b border-surface-800">
                    <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Earlier</p>
                  </div>
                )}
                {read.map(n => <NotificationItem key={n.id} n={n} onMarkRead={markRead} onClose={onClose} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
