'use client'

import type { CSSProperties } from 'react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const borderStyle = 'var(--capabilities-border)'

const copyStyle: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
  lineHeight: 1.6,
  letterSpacing: '-0.01em',
}

const primaryCtaClass =
  'inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]'

export default function ClosingPosition() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="py-24 md:py-40">
        <div style={{ borderTop: borderStyle, borderLeft: borderStyle }}>
          <div
            className="flex flex-col items-center text-center px-7 md:px-9 py-20 md:py-28"
            style={{ borderRight: borderStyle, borderBottom: borderStyle }}
          >
            <p className="text-gray-600 dark:text-[#a8a898] max-w-[34ch]" style={copyStyle}>
              Give AI agents an action path you can trust.
            </p>
            <a
              href="https://console.igrisinertial.com/auth?mode=signup"
              className={`mt-8 ${primaryCtaClass}`}
              style={{ fontFamily: SANS }}
            >
              Create your first action
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}