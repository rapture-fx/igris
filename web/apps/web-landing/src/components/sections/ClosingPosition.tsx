'use client'

import HeroLabBackground from '../ui/HeroLabBackground'

const PIXEL = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export default function ClosingPosition() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="py-24 md:py-40">
        <div className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
          <div className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]">
            <div className="relative overflow-hidden rounded-[10px] bg-[#f7f7f5] dark:bg-[#0e0e0c] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]">
              <HeroLabBackground />
              <div className="relative z-10 flex flex-col items-center text-center px-6 md:px-16 py-20 md:py-32">
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
                  className="mt-8 inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-gray-700 text-white dark:bg-[#c8c8b8] dark:text-[#1b1912]"
                  style={{ fontFamily: SANS }}
                >
                  Create your first action
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}