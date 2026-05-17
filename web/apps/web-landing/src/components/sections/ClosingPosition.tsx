'use client'

import React from 'react'
import Link from 'next/link'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

export default function ClosingPosition() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12">

          <div className="pt-12 md:pt-20 pb-12 md:pb-20">
            <div
              className="pb-4 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: PIXEL }}
            >
              05&nbsp;·&nbsp;GET&nbsp;STARTED
            </div>
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
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[62ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Use Igris when agent actions need recovery, auditability, and
              proof. Skip it when they don&apos;t.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-3">
              <Link
                href="https://console.igrisinertial.com/auth?mode=signup"
                className="group inline-flex items-center gap-3 px-4 py-2.5 border border-gray-900 dark:border-[#f6f6f4] text-[#000000] dark:text-[#f6f6f4] hover:opacity-70 transition-opacity duration-200"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em' }}
              >
                create-account
                <span aria-hidden>{'>'}</span>
              </Link>
              <Link
                href="https://console.igrisinertial.com/auth"
                className="group inline-flex items-center gap-3 px-4 py-2.5 border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 text-[#000000] dark:text-[#f6f6f4]"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em' }}
              >
                sign-in
                <span aria-hidden>{'>'}</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
