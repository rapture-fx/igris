'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

export default function WhatThisIs() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 py-4 md:py-6 lg:py-8" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Empty frame maintaining height */}
          <div className="rounded-2xl relative overflow-hidden" style={{ height: '500px' }}>
          </div>
        </div>
      </div>
    </section>
  )
}
