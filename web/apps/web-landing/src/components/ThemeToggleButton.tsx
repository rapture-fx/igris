'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggleButton({
  className = '',
  iconSize = 14,
}: {
  className?: string
  iconSize?: number
}) {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
    >
      {isDark ? <Sun size={iconSize} strokeWidth={1.8} /> : <Moon size={iconSize} strokeWidth={1.8} />}
    </button>
  )
}