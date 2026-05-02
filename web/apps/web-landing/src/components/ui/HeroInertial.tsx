'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'

export default function HeroInertial() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      style={{
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
    >
      <img 
        src={mounted && theme === 'dark' ? '/dm.png' : '/sat.png'} 
        alt="Saturn"
        className="object-contain"
        style={{
          width: '90%',
          height: '90%',
          opacity: 0.7
        }}
      />
    </div>
  )
}
