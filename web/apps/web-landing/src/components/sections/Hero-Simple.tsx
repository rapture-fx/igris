'use client'

import React from 'react'
import Link from 'next/link'
export default function Hero() {
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent dark:bg-[#1b1912] z-0 overflow-hidden border-l border-r border-gray-300 dark:border-[#f6f6f4]/5" style={{
          height: '500px',
          paddingTop: '72px'
        }}>
          {/* Background image hs.png */}
          <div className="absolute z-0" style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url(/hs.png)',
            backgroundSize: '70% auto',
            backgroundPosition: 'right bottom',
            backgroundRepeat: 'no-repeat'
          }}></div>

          <div className="max-w-[1100px] mx-auto w-full absolute z-10" style={{ bottom: '5rem', left: 0, right: 0, paddingLeft: '4rem', paddingRight: '4rem' }}>
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-lg md:text-xl lg:text-2xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]">
                  The Nervous System for Machines That Can't Fail
                </h1>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-2xl leading-relaxed text-left mt-4">
                  Deterministic AI execution with cryptographic provenance. Whether you're shipping drones to farmland or agents to production—prove every decision, enforce hard limits, survive the apocalypse.
                </p>
                <div className="flex flex-wrap gap-2 md:gap-3 mt-4 text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter">
                  <span>16MB binary</span>
                  <span>·</span>
                  <span>Deterministic execution</span>
                  <span>·</span>
                  <span>Cryptographic signing</span>
                  <span>·</span>
                  <span>Offline-first</span>
                </div>
              </div>
            </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="https://docs.igrisinertial.com/runtime/quickstart">
                  <button
                    className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 md:px-4 md:py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    Download Runtime
                  </button>
                </Link>
              </div>
          </div>
        </div>
      </div>
    </section>
  )
}
