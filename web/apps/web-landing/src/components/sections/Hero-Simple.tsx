'use client'

import React from 'react'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export default function Hero() {
  return (
    <section className="relative w-full min-h-[90vh] overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="relative mx-auto flex min-h-[90vh] max-w-[1400px] flex-col px-4 pb-24 pt-32 sm:px-6 lg:px-8 lg:pb-32 lg:pt-40">
        <div className="flex flex-1 flex-col items-start justify-center gap-10 text-left lg:gap-14">
          <div className="flex flex-col items-start">
            <h1
              className="text-black dark:text-[#f6f6f4]"
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
              }}
            >
              Action layer<br />for AI agents
            </h1>
            <div className="mt-8 flex flex-wrap items-center justify-start gap-4">
              <a
                href="/auth?mode=signup"
                className="inline-flex items-center justify-center rounded-full bg-[#1b1912] px-8 py-3.5 text-[15px] font-medium text-[#f6f6f4] transition-opacity hover:opacity-80 dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                style={{ fontFamily: SANS }}
              >
                Get API key
              </a>
              <a
                href={DOCS_LINKS.agents}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-8 py-3.5 text-[15px] font-medium text-black transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-[rgba(246,246,244,0.12)] dark:text-[#f6f6f4] dark:hover:border-[rgba(246,246,244,0.2)] dark:hover:bg-white/[0.04]"
                style={{ fontFamily: SANS }}
              >
                Set up an agent
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}