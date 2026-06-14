'use client'

import React from 'react'
import HeroLabBackground from '../ui/HeroLabBackground'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

const LAB_CARD =
  'relative h-full min-h-[320px] overflow-hidden rounded-xl border border-[var(--landing-surface-border)] bg-[var(--landing-surface)] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] transition-colors duration-200 dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]'

export default function Hero() {
  return (
    <section className="relative w-full min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="relative mx-auto h-full min-h-[inherit] max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col gap-10 pb-10 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10 lg:pb-14">
          <div className="flex flex-col items-start justify-center text-left lg:max-w-[520px] lg:shrink-0">
            <h1
              className="text-gray-700 dark:text-[#c8c8b8]"
              style={{
                fontFamily: PIXEL,
                fontWeight: 400,
                fontSize: 'clamp(2rem, 5.5vw, 3.75rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
              }}
            >
              Give agents a safe way to act.
            </h1>
            <p
              className="mt-4 max-w-[560px] text-gray-600 dark:text-[#a8a898]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
                lineHeight: 1.6,
                letterSpacing: '-0.01em',
              }}
            >
              Igris lets agents call APIs, trigger workflows, access files, and run tasks through one
              controlled path, with recovery and proof built in.
            </p>
            <a
              href="/auth?mode=signup"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1b1912] px-3.5 py-1.5 text-[11px] font-medium text-[#f6f6f4] transition-opacity hover:opacity-80 dark:bg-[#f6f6f4] dark:text-[#1b1912]"
              style={{ fontFamily: SANS }}
            >
              Create your first action
            </a>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:gap-4 lg:ml-auto lg:w-[min(58%,720px)] lg:shrink-0 lg:min-h-[calc(100dvh-3.5rem)] lg:py-6">
            <div className={LAB_CARD} aria-hidden>
              <HeroLabBackground contained ribbon="green" />
            </div>
            <div className={LAB_CARD} aria-hidden>
              <HeroLabBackground contained ribbon="blue" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}