'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

export default function WhatThisIs() {
  const lines = [
    "This is the execution layer beneath intelligence.",
    "It does not decide what models think; it governs how they run.",
    "Execution is deterministic, bounded, and cryptographically verifiable by design.",
    "Built for systems that must survive failure, operate offline, and prove every decision.",
    "If models are the brain, this is the nervous system that enforces behavior."
  ]

  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 py-4 md:py-6 lg:py-8" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Frame with right-aligned card */}
          <div className="rounded-2xl flex items-stretch justify-end relative overflow-hidden mobile-auto-height" style={{ minHeight: '500px', maxHeight: '600px', padding: '1rem' }}>
            <img
              src={mounted && theme === 'dark' ? '/hs.png' : '/runtimeframe.png'}
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-0 rounded-2xl"
              style={{ opacity: 0.9 }}
            />
            <div className="w-full max-w-md bg-[#f6f6f4] dark:bg-[#1b1912] border border-gray-300 dark:border-[#f6f6f4]/5 p-8 md:p-10 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_30px_rgba(246,246,244,0.15)] z-10 flex flex-col justify-start">
              {lines.map((line, index) => (
                <p 
                  key={index}
                  className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4] leading-relaxed"
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
