'use client'

import React from 'react'

export default function ImmutableCore() {
  const lines = [
    "The deterministic execution layer that makes intelligence work everywhere."
  ]

  return (
    <section className="bg-[#000000] dark:bg-[#000000] text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-[#f6f6f4]/20">
          <div className="py-24 md:py-32 text-center">
            <p className="text-xl md:text-2xl lg:text-3xl font-inter font-medium text-[#f6f6f4] leading-relaxed max-w-4xl mx-auto">
              {lines[0]}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
