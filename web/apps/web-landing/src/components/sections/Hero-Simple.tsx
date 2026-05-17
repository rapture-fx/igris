'use client'

import React from 'react'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

export default function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
      style={{ minHeight: 'clamp(620px, 84vh, 820px)' }}
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="px-2 md:px-4 lg:px-6">
          <div className="flex flex-col justify-end pt-40 md:pt-56 pb-16 md:pb-24">

            <h1
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: PIXEL,
                fontWeight: 500,
                fontSize: 'clamp(1.6rem, 3.4vw, 2.6rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                maxWidth: '26ch',
              }}
            >
              Run agent tasks that recover and prove what happened.
            </h1>

            <p
              className="mt-6 text-gray-700 dark:text-[#c8c8b8] max-w-[62ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)',
                lineHeight: 1.65,
              }}
            >
              Igris is an execution layer for AI agents that touch real systems —
              files, APIs, databases, workflows, and deployment paths. Every
              committed action becomes durable, signed evidence. When a host
              fails mid-run, work resumes from recorded progress; committed
              actions never replay.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-3">
              <a
                href="https://console.igrisinertial.com/auth?mode=signup"
                className="group inline-flex items-center gap-3 px-4 py-2.5 rounded-md border border-gray-900 dark:border-[#f6f6f4] text-[#000000] dark:text-[#f6f6f4] hover:opacity-70 transition-opacity duration-200"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em' }}
              >
                get-started
                <span aria-hidden>{'>'}</span>
              </a>
              <a
                href="https://docs.igrisinertial.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 px-4 py-2.5 rounded-md text-gray-700 dark:text-[#c8c8b8] border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-all duration-200"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em' }}
              >
                docs
                <span aria-hidden>{'↗'}</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}