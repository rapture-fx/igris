'use client'

import React from 'react'

const PIXEL = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export default function ClosingPosition() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="px-0">
        <div className="px-0">

          <div className="pt-24 md:pt-40 pb-24 md:pb-40 min-h-[70vh] flex items-center justify-end">
            <div>
              <h2
                className="text-[#000000] dark:text-[#f6f6f4]"
                style={{
                  fontFamily: PIXEL,
                  fontWeight: 500,
                  fontSize: 'clamp(2rem, 3.6vw, 3rem)',
                  lineHeight: 1.12,
                  letterSpacing: '-0.005em',
                  maxWidth: '24ch',
                }}
              >
                AI can do more when execution can be trusted.
              </h2>
              <a
                href="https://console.igrisinertial.com/auth?mode=signup"
                className="mt-8 inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                style={{ fontFamily: SANS }}
              >
                Get started
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
