'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

export default function WhatThisIs() {
  const lines = [
    "This is the execution layer beneath intelligence.",
    "It doesn't decide what AI thinks.",
    "It enforces how AI runs.",
    "Behavior is bounded, repeatable, and verifiable by design.",
    "For systems where AI must survive failure, operate offline, and prove every decision.",
    "If AI is the brain, this is the nervous system that enforces reality."
  ]

  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 py-4 md:py-8 lg:py-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          {/* Frame with centered card */}
          <div className="rounded-lg flex items-center justify-center relative overflow-hidden" style={{ height: '700px', padding: '3rem' }}>
            <img
              src={mounted && theme === 'dark' ? '/hs.png' : '/runtimeframe.png'}
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{ opacity: 0.9 }}
            />
            <div className="max-w-xl mx-auto bg-[#f6f6f4] dark:bg-[#1b1912] border border-gray-300 dark:border-[#f6f6f4]/5 p-8 md:p-16 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_30px_rgba(246,246,244,0.15)] z-10">
              {lines.map((line, index) => (
                <p 
                  key={index}
                  className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4] leading-relaxed"
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
