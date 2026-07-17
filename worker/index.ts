// ============================================================
// Custom Service Worker additions — merged into sw.js by next-pwa.
// Compiled in webworker lib context — standard SW types apply.
//
// Handles:
//   • push   — show browser notification when a push arrives
//   • notificationclick — open/focus the right URL on click
// ============================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Push event ────────────────────────────────────────────────
(self as any).addEventListener('push', (event: any) => {
  if (!event.data) return

  let payload: {
    title?: string
    body?: string
    icon?: string
    badge?: string
    url?: string
    tag?: string
  } = {}

  try {
    payload = event.data.json()
  } catch {
    payload = { body: event.data.text() }
  }

  const title   = payload.title  ?? 'PipeField OS'
  const options = {
    body:  payload.body  ?? '',
    icon:  payload.icon  ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/icon-72.png',
    tag:   payload.tag   ?? 'pipefield',
    data:  { url: payload.url ?? '/dashboard' },
    requireInteraction: false,
  }

  event.waitUntil((self as any).registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────────
(self as any).addEventListener('notificationclick', (event: any) => {
  event.notification.close()

  const targetUrl: string = event.notification.data?.url ?? '/dashboard'

  event.waitUntil(
    (self as any).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: any[]) => {
        for (const client of clientList) {
          if ('focus' in client) {
            void client.navigate(targetUrl)
            return client.focus()
          }
        }
        if ((self as any).clients.openWindow) {
          return (self as any).clients.openWindow(targetUrl)
        }
      })
  )
})
