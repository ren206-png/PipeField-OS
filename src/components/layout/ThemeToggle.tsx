'use client'
// ============================================================
// ThemeToggle — Sun / Moon button for the header bar.
// Reads from and writes to ThemeProvider via useTheme().
// ============================================================
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export function ThemeToggle({ className }: Props) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'relative p-2 rounded-lg transition-colors',
        'text-surface-400 hover:text-surface-100 hover:bg-surface-700/50',
        className
      )}
    >
      {/* Sun icon — visible in dark mode (click → go light) */}
      <Sun
        className={cn(
          'w-4 h-4 absolute inset-0 m-auto transition-all duration-200',
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
        )}
      />
      {/* Moon icon — visible in light mode (click → go dark) */}
      <Moon
        className={cn(
          'w-4 h-4 absolute inset-0 m-auto transition-all duration-200',
          isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
        )}
      />
      {/* Invisible placeholder to hold the button size */}
      <span className="w-4 h-4 block opacity-0" aria-hidden />
    </button>
  )
}
