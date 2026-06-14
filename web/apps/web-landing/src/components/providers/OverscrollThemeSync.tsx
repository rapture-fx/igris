'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const LIGHT_OVERSCROLL = '#ffffff'
const DARK_OVERSCROLL = '#010203'

export function OverscrollThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const bg = resolvedTheme === 'dark' ? DARK_OVERSCROLL : LIGHT_OVERSCROLL
    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', bg)
  }, [resolvedTheme])

  return null
}