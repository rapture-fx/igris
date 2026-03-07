'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -sSL https://igris.sh/install | bash'

export default function InstallSection() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const isDark = mounted && theme === 'dark'

  return (
    <section className="bg-white dark:bg-dark-bg transition-colors duration-200">
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div
          style={{
            borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)',
            borderRight: '0.5px solid rgba(209, 213, 219, 0.35)',
            minHeight: '400px',
          }}
          className="flex flex-col justify-center items-center px-8 md:px-12 lg:px-16 py-16"
        >
          {/* Command block */}
          <div
            className="inline-flex items-center gap-4 rounded-md px-5 py-3 font-mono text-sm border self-center"
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
              borderColor: isDark ? 'rgba(246,246,244,0.08)' : 'rgba(0,0,0,0.08)',
              color: isDark ? '#c8c8b8' : '#374151',
            }}
          >
            <span className="select-all">{INSTALL_CMD}</span>
            <button
              onClick={copy}
              className="shrink-0 transition-opacity hover:opacity-60"
              title={copied ? 'Copied' : 'Copy'}
              style={{ color: isDark ? '#a8a898' : '#6b7280' }}
            >
              {copied ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>

          {/* Manual download link */}
          <div className="mt-3">
            <a
              href="https://admin.igris-inertial.com/downloads/runtime"
              className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: isDark ? '#6b6b5e' : '#9ca3af', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Manual download →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
