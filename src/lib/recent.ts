// ============================================================
// Recently-viewed record helpers
// localStorage key: pipefield_recent
// ============================================================

export type RecentItem = {
  id: string
  label: string
  href: string
  type: string
  timestamp: number
}

const KEY = 'pipefield_recent'
const MAX = 8

export function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as RecentItem[]
  } catch {
    return []
  }
}

export function addRecent(item: RecentItem): void {
  try {
    const existing = getRecent().filter(r => r.id !== item.id)
    const updated = [item, ...existing].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    // SSR or storage quota — silently ignore
  }
}
