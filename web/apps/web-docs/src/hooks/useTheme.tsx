'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'schlep-docs-theme';

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      return savedTheme
    }
  }
  return 'light' // Default theme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with 'light' to avoid hydration mismatch, then update on client
  const [theme, setThemeState] = useState<Theme>('light')
  const [isClient, setIsClient] = useState(false)

  const applyTheme = useCallback((themeToApply: Theme) => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(themeToApply)
    localStorage.setItem(THEME_STORAGE_KEY, themeToApply)

    const body = document.body;
    if (themeToApply === 'dark') {
      body.classList.add('bg-gray-900', 'text-white');
      body.classList.remove('bg-white', 'text-gray-900');
    } else {
      body.classList.add('bg-white', 'text-gray-900');
      body.classList.remove('bg-gray-900', 'text-white');
    }
  }, [])

  // Check for saved theme only on client side to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true)
    const savedTheme = getInitialTheme()
    setThemeState(savedTheme)
  }, [])

  useEffect(() => {
    if (isClient) {
      applyTheme(theme)
    }
  }, [theme, applyTheme, isClient])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
