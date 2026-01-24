'use client'

import React from 'react'
import Link from 'next/link'
export default function Hero() {
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px]">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent dark:bg-[#1b1912] z-10 overflow-hidden border-l border-r section-border" style={{
          height: '500px'
        }}>
          {/* Background image with opacity */}
          <div className="absolute z-0" style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url(/hhr.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.6
          }}></div>

          <div className="max-w-[1100px] mx-auto w-full absolute z-10" style={{ bottom: '5rem', left: 0, right: 0, paddingLeft: '4rem', paddingRight: '4rem' }}>
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-lg md:text-xl lg:text-2xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]">
                  Control how AI systems behave<br />in production
                </h1>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4">
                  A decision control, governed execution, and verification across modern AI stacks.
                </p>
              </div>
            </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/overture">
                  <button
                    className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 md:px-4 md:py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    Get Started
                  </button>
                </Link>
             </div>
          </div>
        </div>
      </div>
    </section>
  )
}
