'use client'

import React, { useCallback, useState } from 'react'

const SANS  = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-inter), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

export default function ClosingPosition() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-none px-3 sm:px-4 lg:px-5">
        <div className="px-0">

          <div className="pt-12 md:pt-20 pb-12 md:pb-20 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <h2
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: PIXEL,
                fontWeight: 500,
                fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)',
                lineHeight: 1.12,
                letterSpacing: '-0.005em',
                maxWidth: '24ch',
              }}
            >
              Give agents real work you can recover and prove.
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-3 md:justify-end">
              <div
                className="inline-flex items-center gap-3 rounded-md px-3 py-2.5 border bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-[rgba(246,246,244,0.12)] text-gray-800 dark:text-[#c8c8b8] max-w-full overflow-hidden"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.02em' }}
              >
                <span className="select-all truncate">{INSTALL_CMD}</span>
                <button
                  onClick={copy}
                  aria-label={copied ? 'Copied' : 'Copy install command'}
                  className="shrink-0 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
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
          </div>

        </div>
      </div>
    </section>
  )
}
