// ============================================================
// Utility Functions
// Small helper functions used throughout the app.
// ============================================================
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes safely without conflicts.
 * Usage: cn('px-4 py-2', isActive && 'bg-brand-500', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string into a readable label.
 * Input:  "2025-06-05T14:30:00Z"
 * Output: "Jun 5, 2025"
 *
 * NOTE: No explicit timeZone is set — on the server (Vercel/UTC) this will
 * render in UTC. Call these functions only from client components, or prefer
 * the <LocalTime> client component for user-facing timestamps.
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format a date + time string.
 * Output: "Jun 5, 2025 at 2:30 PM"
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Generate a short UUID-style ID for display purposes.
 * Not for database IDs — use Supabase UUID for those.
 */
export function generateDisplayId(prefix: string, count: number): string {
  return `${prefix}-${String(count).padStart(4, '0')}`
}

/**
 * Truncate a long string with an ellipsis.
 * Usage: truncate("Long organization name here", 20) → "Long organization na…"
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}…`
}

/**
 * Convert a name to a URL-safe slug.
 * "ABC Mechanical Inc" → "abc-mechanical-inc"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Get the user's initials from their full name.
 * "Renner Kargbo" → "RK"
 */
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
