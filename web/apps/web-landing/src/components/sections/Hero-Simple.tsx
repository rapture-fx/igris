'use client'

import React from 'react'
import { ExecutionPreview } from './Products'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

export default function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
      style={{ minHeight: 'calc(100vh - 3.5rem)' }}
    >
      <div className="relative mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex flex-col items-start text-left justify-end pt-12 md:pt-16 pb-4 md:pb-6">

            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6 w-full items-start">
              <h1
                className="md:col-span-7 text-[#000000] dark:text-[#f6f6f4]"
                style={{
                  fontFamily: PIXEL,
                  fontWeight: 500,
                  fontSize: 'clamp(1.6rem, 3.4vw, 2.6rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.01em',
                }}
              >
                Run agent actions that recover and prove what happened.
              </h1>

              <p
                className="md:col-span-5 md:mt-2 text-gray-700 dark:text-[#c8c8b8]"
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)',
                  lineHeight: 1.65,
                }}
              >
                Igris sits between AI and the actions it wants to perform. When
                your AI needs to read a file, call an API, update a database, or
                trigger a workflow, Igris runs that action safely, records what
                happened, and gives your team proof afterward. If execution breaks
                mid-run, Igris resumes from the last recorded step instead of
                starting from zero.
              </p>
            </div>

          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 mt-3 pb-12 md:pb-16">
        <ExecutionPreview />
      </div>
    </section>
  )
}