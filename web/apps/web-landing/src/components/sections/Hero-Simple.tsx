'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

export default function Hero() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <section className="pb-0 bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200" style={{ marginTop: '48px' }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden flex flex-col justify-center min-h-[auto] md:min-h-[calc(100vh-52px)]" style={{ marginBottom: '2rem' }}>
          <div className="max-w-[1100px] mx-auto w-full relative z-10 pb-6 md:pb-10 pt-0 px-4 md:px-8 lg:px-12">
            
            {/* Title row — on desktop: title left + description right */}
            <div className="flex flex-col gap-2 mb-4 md:mb-10">
              <h1 className="text-xl md:text-2xl lg:text-3xl leading-tight text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                Run AI tasks with verifiable execution.
              </h1>
              <p className="text-lg text-left text-gray-500 dark:text-gray-400 max-w-[500px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                Igris gives AI systems a governed execution layer for controlled runs, fallback paths, and signed records of what happened.
              </p>
              <div className="flex gap-3">
                <a href="/core" className="inline-flex items-center justify-center px-4 py-2 mt-4 text-sm font-medium rounded-lg bg-[#1b1912] dark:bg-[#f6f6f4] text-[#f6f6f4] dark:text-[#1b1912] cursor-pointer transition-opacity hover:opacity-80" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Get Started
                </a>
                <a href="/docs" className="inline-flex items-center justify-center px-4 py-2 mt-4 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-[#000000] dark:text-[#f6f6f4] cursor-pointer transition-opacity hover:opacity-80" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  View Docs
                </a>
              </div>
            </div>

            {/* Image with frame */}
            <img src="/lhjk.png" alt="Hero" className="h-full w-full object-cover rounded-xl min-h-[200px] md:min-h-[400px]" style={{ maxHeight: '1000px' }} />

            {/* Description — mobile only */}
            <p className="md:hidden mt-4 text-xs text-center text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
              Igris gives AI systems a governed execution layer for controlled runs, fallback paths, and signed records of what happened.
            </p>

          </div>
        </div>
      </div>
    </section>
  )
}