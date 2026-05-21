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
      <div className="relative mr-auto max-w-[1000px] px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex flex-col items-start text-left justify-end pt-32 md:pt-44 pb-4 md:pb-6">

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
              Run agent actions that recover and prove what happened.
            </h1>

            <p
              className="mt-6 text-gray-700 dark:text-[#c8c8b8] max-w-[62ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)',
                lineHeight: 1.65,
              }}
            >
              Igris sits between AI and the actions it wants to perform.
              When your AI needs to read a file, call an API, update a
              database, or trigger a workflow, Igris runs that action safely,
              records what happened, and gives your team proof afterward.
              If execution breaks mid-run, Igris resumes from the last
              recorded step instead of starting from zero.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-start gap-x-3 gap-y-3">
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

      <div className="mr-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 mt-10 pb-24 md:pb-32">
        <img
          src="/hand.png"
          alt=""
          aria-hidden
          className="block w-full h-auto rounded-lg select-none pointer-events-none"
        />
      </div>
    </section>
  )
}