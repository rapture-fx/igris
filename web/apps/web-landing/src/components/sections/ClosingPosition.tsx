'use client'

import { LandingSurfaceFrame } from '../ui/ProductConsoleShell'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export default function ClosingPosition() {
  return (
    <section className="bg-white text-[#171717]">
      <div className="pt-10 md:pt-14 pb-24 md:pb-40">
        <LandingSurfaceFrame>
          <div className="landing-surface-panel flex flex-col items-center text-center px-6 md:px-16 py-20 md:py-32">
                <h2
                  className="text-[#171717]"
                  style={{
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: 'clamp(1.75rem, 4vw, 3rem)',
                    lineHeight: 1.08,
                    letterSpacing: '-0.04em',
                    maxWidth: '24ch',
                  }}
                >
                  Give AI agents an action path you can trust.
                </h2>
                <a
                  href="https://console.igrisinertial.com/auth?mode=signup"
                  className="mt-8 inline-flex h-10 items-center justify-center rounded-[6px] bg-[#171717] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#383838]"
                  style={{ fontFamily: SANS }}
                >
                  Get API Key
                </a>
          </div>
        </LandingSurfaceFrame>
      </div>
    </section>
  )
}