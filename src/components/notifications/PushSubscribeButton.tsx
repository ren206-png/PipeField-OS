'use client'
// ============================================================
// PushSubscribeButton
// Lets users opt in/out of browser push notifications.
// Handles permission request, subscription creation, and
// server registration via /api/notifications/subscribe.
// ============================================================
import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2, BellRing } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { cn } from '@/lib/utils'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  const output   = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function PushSubscribeButton({ className }: { className?: string }) {
  const [state,   setState]   = useState<PushState>('loading')
  const [working, setWorking] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setState(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setState('unsubscribed'))
  }, [])

  async function handleSubscribe() {
    setWorking(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as BufferSource,
      })

      const json = sub.toJSON()
      await apiFetch('/api/notifications/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: navigator.userAgent,
        }),
      })

      setState('subscribed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscribe failed')
    } finally {
      setWorking(false)
    }
  }

  async function handleUnsubscribe() {
    setWorking(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await apiFetch('/api/notifications/subscribe', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unsubscribe failed')
    } finally {
      setWorking(false)
    }
  }

  if (state === 'unsupported') {
    return (
      <p className="text-xs text-surface-500">
        Push notifications are not supported in this browser.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {state === 'subscribed' ? (
          <button
            onClick={() => void handleUnsubscribe()}
            disabled={working}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className,
            )}
          >
            {working
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <BellRing className="w-4 h-4" />
            }
            {working ? 'Updating…' : 'Push enabled — click to disable'}
          </button>
        ) : state === 'denied' ? (
          <div className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            <BellOff className="w-4 h-4" />
            Notifications blocked — enable in browser settings
          </div>
        ) : (
          <button
            onClick={() => void handleSubscribe()}
            disabled={working || state === 'loading'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'bg-surface-700 border border-surface-600 text-surface-300 hover:bg-brand-500/15 hover:border-brand-500/40 hover:text-brand-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className,
            )}
          >
            {working
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Bell className="w-4 h-4" />
            }
            {working ? 'Enabling…' : 'Enable push notifications'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
