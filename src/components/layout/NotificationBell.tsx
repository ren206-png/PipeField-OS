'use client'
// ============================================================
// NotificationBell — Bell icon with live unread badge + dropdown
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Flame,
  MessageSquareMore,
  AlertOctagon,
  CheckCircle,
  Wrench,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications, type DbNotification } from '@/hooks/useNotifications'

// ── Map notification type → icon ──────────────────────────
function NotifIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 flex-shrink-0'
  switch (type) {
    case 'weld_failed':      return <Flame           className={cn(cls, 'text-red-400')}    />
    case 'weld_accepted':    return <CheckCircle     className={cn(cls, 'text-green-400')}  />
    case 'repair_required':  return <Wrench          className={cn(cls, 'text-orange-400')} />
    case 'ncr_created':      return <AlertOctagon    className={cn(cls, 'text-red-400')}    />
    case 'rfi_created':      return <MessageSquareMore className={cn(cls, 'text-blue-400')} />
    default:                 return <Info            className={cn(cls, 'text-surface-400')} />
  }
}

// ── Time-ago helper ────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── NotificationRow ────────────────────────────────────────
function NotificationRow({
  notif,
  onRead,
}: {
  notif: DbNotification
  onRead: (id: string, href: string | null) => void
}) {
  return (
    <button
      key={notif.id}
      onClick={() => onRead(notif.id, notif.href)}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors',
        notif.is_read
          ? 'hover:bg-surface-800/50'
          : 'bg-brand-500/5 hover:bg-brand-500/10 border-l-2 border-brand-500'
      )}
    >
      <span className="mt-0.5">
        <NotifIcon type={notif.type} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          notif.is_read ? 'text-surface-400' : 'text-surface-100'
        )}>
          {notif.title}
        </p>
        <p className="text-xs text-surface-500 truncate">{notif.body}</p>
      </div>
      <span className="text-[10px] text-surface-600 whitespace-nowrap mt-0.5 flex-shrink-0">
        {timeAgo(notif.created_at)}
      </span>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef  = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const { notifications, unreadCount, markRead, markAllRead, isLoading } = useNotifications()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current  && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const handleRead = useCallback(async (id: string, href: string | null) => {
    setOpen(false)
    await markRead(id)
    if (href) router.push(href)
  }, [markRead, router])

  const handleMarkAll = useCallback(async () => {
    await markAllRead()
  }, [markAllRead])

  // Sort: unread first, then by created_at desc
  const sorted = [...notifications].sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? 1 : -1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="nav-item w-full"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-4 h-4 text-surface-500 flex-shrink-0" />
        <span className="flex-1">Notifications</span>
        {unreadCount > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — absolute so it works inside the sidebar's overflow container */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-full ml-2 bottom-0 z-50 w-80 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
            <p className="text-sm font-semibold text-surface-100">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-800">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-surface-500">Loading…</div>
            ) : sorted.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-8 h-8 text-surface-700 mx-auto mb-2" />
                <p className="text-sm text-surface-500">No notifications yet</p>
              </div>
            ) : (
              sorted.map((n) => (
                <NotificationRow key={n.id} notif={n} onRead={handleRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
