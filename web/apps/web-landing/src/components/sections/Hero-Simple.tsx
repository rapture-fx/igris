'use client'

import React from 'react'
import { ExecutionPreview } from './Products'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

export default function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
      style={{
        backgroundImage: 'url(/herobg.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center bottom',
        backgroundSize: 'cover',
      }}
    >
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex flex-col items-start text-left justify-end pt-20 md:pt-28 pb-4 md:pb-6">

            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-6 w-full items-start">
              <div className="md:col-span-7">
                <h1
                  className="text-[#000000] dark:text-[#f6f6f4]"
                  style={{
                    fontFamily: PIXEL,
                    fontWeight: 500,
                    fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Run agent actions that recover<br />and prove what happened.
                </h1>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <a
                    href="https://console.igrisinertial.com/auth?mode=signup"
                    className="inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                    style={{ fontFamily: SANS }}
                  >
                    Get started
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl border transition-colors border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-[rgba(246,246,244,0.18)] dark:text-[#c8c8b8] dark:hover:bg-white/[0.04]"
                    style={{ fontFamily: SANS }}
                  >
                    See how it works
                  </a>
                </div>
              </div>

              <div className="md:col-span-5">
                <p
                  className="text-[#3a3830] dark:text-[#a8a89e] max-w-[360px] ml-auto text-right"
                  style={{
                    fontFamily: SANS,
                    fontSize: 'clamp(0.95rem, 1.4vw, 1.2rem)',
                    lineHeight: 1.45,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Give agents safe action endpoints. Igris routes the work, records the run, recovers failures, and keeps evidence you can inspect.
                </p>
              </div>


            </div>

          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 mt-3 pb-12 md:pb-16">
        <ExecutionPreview />
      </div>
    </section>
  )
}