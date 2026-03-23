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
    <section className="pb-0 bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200" style={{ marginTop: '20px' }}>
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden flex flex-col justify-center min-h-[auto] md:min-h-[calc(100vh-52px)]" style={{ marginBottom: '2rem' }}>
          <div className="max-w-[1600px] mx-auto w-full relative z-10 pb-6 md:pb-10 pt-0 px-4 md:px-8 lg:px-12">
            
            {/* Image with frame */}
            <div className="rounded-lg mb-6 overflow-hidden relative" style={{ height: '800px' }}>
              <img src="/lhjk.png" alt="Hero" className="h-full w-full object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
              
              {/* Install command - center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="inline-flex items-center gap-2 md:gap-3 rounded-md px-3 py-1.5 md:px-5 md:py-2.5 text-xs md:text-sm border shadow-lg"
                  style={{
                    backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#ffffff',
                    borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : 'rgba(0,0,0,0.1)',
                    color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151',
                  }}
                >
                  <img src="/inertia.png" alt="Igris" className="h-6 w-6 shrink-0 opacity-80" />
                  <span className="select-all truncate max-w-[180px] md:max-w-none">{INSTALL_CMD}</span>
                  <button
                    onClick={copy}
                    className="shrink-0 transition-opacity hover:opacity-60"
                    title={copied ? 'Copied' : 'Copy'}
                    style={{ color: mounted && theme === 'dark' ? '#a8a898' : '#6b7280' }}
                  >
                    {copied ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Title and subtext - bottom of image */}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                <div className="text-left">
                  <h1 className="text-xl md:text-3xl lg:text-4xl mb-2 leading-tight" style={{ color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                    Run AI that survives failure<br />
                    <span className="mt-2 block">and proves what it did.</span>
                  </h1>
                </div>
                <div className="text-left md:text-right" style={{ maxWidth: '300px' }}>
                  <p className="text-base md:text-lg" style={{ color: '#e5e5e5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                    Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
