'use client'

import { LandingSurfaceFrame } from '../ui/ProductConsoleShell'

const PIXEL = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export default function ClosingPosition() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="pt-10 md:pt-14 pb-24 md:pb-40">
        <LandingSurfaceFrame>
          <div className="landing-surface-panel flex flex-col items-center text-center px-6 md:px-16 py-20 md:py-32">
                <h2
                  className="text-gray-700 dark:text-[#c8c8b8]"
                  style={{
                    fontFamily: PIXEL,
                    fontWeight: 400,
                    fontSize: 'clamp(1.4rem, 2.8vw, 2.4rem)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                    maxWidth: '24ch',
                  }}
                >
                  Give AI agents an action path you can trust.
                </h2>
                <a
                  href="https://console.igrisinertial.com/auth?mode=signup"
                  className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1b1912] px-5 py-2.5 text-[13px] font-medium text-[#f6f6f4] transition-opacity hover:opacity-80 dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                  style={{ fontFamily: SANS }}
                >
                  Get API key
                </a>
          </div>
        </LandingSurfaceFrame>
      </div>
    </section>
  )
}