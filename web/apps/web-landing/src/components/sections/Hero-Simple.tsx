'use client'

import React from 'react'
import HeroLabBackground from '../ui/HeroLabBackground'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

export default function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <HeroLabBackground />
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start text-left justify-center             min-h-[60vh] md:min-h-[70vh] pt-24 md:pt-28 pb-10 md:pb-14">
          
          <h1
            className="text-gray-700 dark:text-[#c8c8b8]"
            style={{
              fontFamily: PIXEL,
              fontWeight: 400,
              fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
          >
            Run agent actions that recover<br />and prove what happened.
          </h1>
          <p
            className="mt-4 text-gray-600 dark:text-[#a8a898] max-w-[560px]"
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
              lineHeight: 1.6,
              letterSpacing: '-0.01em',
            }}
          >
            Give agents safe action endpoints. Igris routes the work, records the run, recovers failures, and keeps evidence you can inspect.
          </p>
          <a
            href="https://console.igrisinertial.com/auth?mode=signup"
            className="mt-5 inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
            style={{ fontFamily: SANS }}
          >
            Get started
          </a>
        </div>
      </div>
    </section>
  )
}