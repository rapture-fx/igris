'use client'

import React from 'react'
import HeroLabBackground from '../ui/HeroLabBackground'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

const LAB_CARD_BASE =
  'relative overflow-hidden rounded-xl border border-[var(--landing-surface-border)] bg-[var(--landing-surface)] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] transition-colors duration-200 dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]'

const LAB_CARD_TALL = `${LAB_CARD_BASE} h-full min-h-[240px]`
const LAB_CARD_BLUE = `${LAB_CARD_BASE} min-h-[200px] flex-1`

export default function Hero() {
  return (
    <section className="relative w-full h-[calc(100dvh-3.5rem)] overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="relative mx-auto flex h-full max-w-[1400px] flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10">
          <div className="flex min-h-0 flex-col lg:h-full lg:max-w-[520px] lg:shrink-0">
            <div className="flex min-h-0 flex-1 flex-col justify-center">
              <h1
                className="text-gray-700 dark:text-[#c8c8b8]"
                style={{
                  fontFamily: PIXEL,
                  fontWeight: 400,
                  fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.01em',
                }}
              >
                Action layer<br />for AI agents.
              </h1>
            </div>
            <div className="mt-8 flex shrink-0 flex-wrap items-center gap-3 lg:mt-6">
              <a
                href="/auth?mode=signup"
                className="inline-flex items-center justify-center rounded-md bg-[#1b1912] px-5 py-2.5 text-[13px] font-medium text-[#f6f6f4] transition-opacity hover:opacity-80 dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                style={{ fontFamily: SANS }}
              >
                Get API key
              </a>
              <a
                href={DOCS_LINKS.agents}
                className="inline-flex items-center justify-center rounded-md border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-[rgba(246,246,244,0.12)] dark:text-[#f6f6f4] dark:hover:border-[rgba(246,246,244,0.2)] dark:hover:bg-white/[0.04]"
                style={{ fontFamily: SANS }}
              >
                Set up an agent
              </a>
            </div>
          </div>

          <div className="grid h-full min-h-0 w-full grid-cols-2 items-stretch gap-3 sm:gap-4 lg:ml-auto lg:w-[min(58%,720px)] lg:shrink-0">
            <div className={LAB_CARD_TALL} aria-hidden>
              <HeroLabBackground contained ribbon="green" />
            </div>
            <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
              <div className={LAB_CARD_BLUE} aria-hidden>
                <HeroLabBackground contained ribbon="blue" />
              </div>
              <p
                className="shrink-0 px-0.5 text-gray-600 dark:text-[#a8a898]"
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(1rem, 1.1vw, 1.125rem)',
                  lineHeight: 1.6,
                }}
              >
                <span className="font-medium text-gray-700 dark:text-[#c8c8b8]">
                  Fits into your agent stack.
                </span>{' '}
                Use your agent framework for reasoning and planning. Use Igris for the final actions
                that need policy, recovery, and receipts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}