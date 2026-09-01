'use client'
// Props: firstName: string
// Renders: "Good morning, Renner 👋" + "Tuesday, September 1, 2026 · Real-time project overview"

import { useEffect, useState } from 'react'

interface DashboardGreetingProps {
  firstName: string
}

export function DashboardGreeting({ firstName }: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState('')
  const [todayLabel, setTodayLabel] = useState('')

  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const label = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now)
    setGreeting(g)
    setTodayLabel(label)
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-50">
        {greeting ? `${greeting}${firstName ? `, ${firstName}` : ''} 👋` : ''}
      </h1>
      <p className="text-sm text-surface-500 mt-0.5">
        {todayLabel ? `${todayLabel} · Real-time project overview` : ' '}
      </p>
    </div>
  )
}
