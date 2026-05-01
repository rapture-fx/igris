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
            <div className="flex items-start justify-between gap-4 mb-4 md:mb-10">
              <h1 className="text-2xl md:text-3xl lg:text-4xl leading-tight text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                Run AI that survives failure<br />
                <span className="mt-1 md:mt-2 block">and proves what it did.</span>
              </h1>
              {/* Description — desktop only (shown beside title) */}
              <div className="hidden md:block text-right shrink-0 max-w-[250px]">
                <p className="text-lg text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere.
                </p>
              </div>
            </div>

            {/* Image with frame */}
            <div className="rounded-xl overflow-hidden relative border min-h-[200px] md:min-h-[400px]" style={{ height: 'auto', maxHeight: '1000px', borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : 'rgba(209,213,219,0.35)', padding: '16px' }}>
              <img src="/lhjk.png" alt="Hero" className="h-full w-full object-cover rounded-xl min-h-[200px] md:min-h-[400px]" style={{ maxHeight: '1000px' }} />
            </div>

            {/* Install command - below image */}
            <div className="flex justify-center px-2 md:px-0 mt-6 md:mt-10">
              <div
                className="inline-flex items-center gap-2 md:gap-3 rounded-2xl px-4 py-2.5 md:px-8 md:py-4 text-sm md:text-lg border shadow w-full md:w-auto justify-center"
                style={{
                  backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#ffffff',
                  borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : 'rgba(0,0,0,0.1)',
                  color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151',
                }}
              >
                <span className="select-all truncate">{INSTALL_CMD}</span>
                <button
                  onClick={copy}
                  className="shrink-0 transition-opacity hover:opacity-60"
                  title={copied ? 'Copied' : 'Copy'}
                  style={{ color: mounted && theme === 'dark' ? '#a8a898' : '#6b7280' }}
                >
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Description — mobile only (shown below install command) */}
            <p className="md:hidden mt-4 text-xs text-center text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
              Deterministic runtime. Cloud + local fallback. OS-level containment with signed violation logs. Deploy anywhere.
            </p>

          </div>
        </div>
      </div>
    </section>
  )
}