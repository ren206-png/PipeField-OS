'use client'
// Usage: <LocalTime dateString="2025-06-05T14:30:00Z" />
// Usage: <LocalTime dateString="2025-06-05T14:30:00Z" dateOnly />
// Usage: <LocalTime dateString="2025-06-05T14:30:00Z" relative />
// Falls back to '—' for null/undefined

import { useEffect, useState } from 'react'

interface LocalTimeProps {
  dateString: string | null | undefined
  dateOnly?: boolean
  relative?: boolean
  className?: string
}

function formatRelative(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr} hr ago`
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(date, false)
}

function formatDate(date: Date, dateOnly: boolean): string {
  if (dateOnly) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function LocalTime({ dateString, dateOnly = false, relative = false, className }: LocalTimeProps) {
  const [formatted, setFormatted] = useState<string>('') // placeholder during SSR

  useEffect(() => {
    if (!dateString) {
      setFormatted('—')
      return
    }
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      setFormatted('—')
      return
    }
    if (relative) {
      setFormatted(formatRelative(date))
    } else {
      setFormatted(formatDate(date, dateOnly))
    }
  }, [dateString, dateOnly, relative])

  if (!formatted) {
    // SSR / pre-mount placeholder — avoids hydration mismatch
    return <span className={className}>—</span>
  }

  return <span className={className}>{formatted}</span>
}
