'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export default function Hero() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <section className="relative w-full min-h-[90vh] overflow-hidden bg-white text-[#171717]">
      <div className="relative mx-auto flex min-h-[90vh] max-w-[1400px] flex-col px-4 pb-24 pt-32 sm:px-6 lg:px-8 lg:pb-32 lg:pt-40">
        <div className="flex flex-1 flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
          <div className="flex w-full flex-col items-start lg:w-2/5">
            <h1
              className="text-[#171717]"
              style={{
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
              }}
            >
              Action layer<br />for AI agents
            </h1>
            <div className="mt-8 flex flex-wrap items-center justify-start gap-3">
              <a
                href="/auth?mode=signup"
                className="inline-flex h-12 items-center justify-center rounded-[6px] bg-[#171717] px-5 text-[16px] font-medium text-white transition-colors hover:bg-[#383838]"
                style={{ fontFamily: SANS }}
              >
                Get API Key
              </a>
              <a
                href={DOCS_LINKS.agents}
                className="inline-flex h-12 items-center justify-center rounded-[6px] border border-[rgba(0,0,0,0.08)] bg-white px-5 text-[16px] font-medium text-[#171717] transition-colors hover:bg-[#fafafa] hover:border-[rgba(0,0,0,0.12)]"
                style={{ fontFamily: SANS }}
              >
                Set Up an Agent
              </a>
            </div>
          </div>
          <div className="flex w-full items-center justify-end lg:-mt-32 lg:w-3/5">
            <img
              src={isDark ? '/dark.png' : '/hero.png'}
              alt="Hero illustration"
              className="h-auto w-full max-w-4xl"
            />
          </div>
        </div>
      </div>
    </section>
  )
}