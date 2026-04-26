'use client'

import { useEffect, useRef } from 'react'

export default function HeroInertial() {
  const containerRef = useRef<HTMLDivElement>(null)

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
        src="/sat.png" 
        alt="Saturn"
        className="object-contain"
        style={{
          width: '70%',
          height: '70%',
          opacity: 0.7
        }}
      />
    </div>
  )
}
