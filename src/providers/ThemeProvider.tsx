'use client'
// ============================================================
// ThemeProvider — dark / light mode
//
// Persists the user's preference in localStorage under the key
// 'pipefield-theme'. Applies 'dark' or 'light' class to <html>
// and exposes { theme, toggleTheme } via useTheme().
//
// A blocking inline script in layout.tsx reads the preference
// and applies the class BEFORE first paint to prevent flash.
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'pipefield-theme'
const DEFAULT_THEME: Theme = 'dark'

interface ThemeContextValue {
  theme:       Theme
  toggleTheme: () => void
  setTheme:    (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:       DEFAULT_THEME,
  toggleTheme: () => {},
  setTheme:    () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  // On mount — read stored preference (or system preference as fallback)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const resolved = stored ?? DEFAULT_THEME
    setThemeState(resolved)
    applyClass(resolved)
  }, [])

  const applyClass = (t: Theme) => {
    const html = document.documentElement
    html.classList.remove('dark', 'light')
    html.classList.add(t)
  }

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyClass(t)
    localStorage.setItem(STORAGE_KEY, t)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
