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
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                style={{ fontFamily: SANS }}
              >
                Get started
              </a>
              <a
                href="https://docs.igrisinertial.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
                style={{ fontFamily: SANS }}
              >
                Docs ↗
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}