'use client'

import React from 'react'
import Image from 'next/image'

export default function Solve() {
  const items = [
    'Pure LLM hallucinations',
    'Non-deterministic AI behavior',
    'Unverifiable decisions',
    'Cloud-dependent execution',
    'No fleet visibility',
    'Hidden performance bottlenecks',
    'Undetected anomalies',
    'Zero behavior history'
  ];

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-2 md:px-8 lg:px-12 bg-[#f6f6f4] dark:bg-[#1b1912] flex flex-row items-center gap-2 md:gap-4 py-2" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', borderRight: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
          {/* Static title */}
          <span className="text-[10px] md:text-sm lg:text-base font-inter font-normal text-[#000000] dark:text-[#f6f6f4] flex-shrink-0 whitespace-nowrap" style={{ fontWeight: 300 }}>
            The Challenge We Solve :
          </span>

          {/* Scrolling container */}
          <div className="flex-1 overflow-hidden relative scroll-container">
            <div className="flex animate-scroll-seamless" style={{ width: 'fit-content' }}>
              {/* First set of items */}
                {items.map((item, index) => (
                  <span
                    key={`first-${index}`}
                    className="inline-block mx-1 md:mx-2 px-2 md:px-3 py-0.5 md:py-1 border border-gray-300 dark:border-[#f6f6f4]/10 rounded-sm min-w-[120px] md:min-w-[140px] text-center font-normal flex-shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2520] transition-colors text-xs md:text-sm whitespace-nowrap"
                    style={{ fontWeight: 300 }}
                    title=""
                  >
                    {item}
                  </span>
                ))}
              {/* Duplicate set for seamless loop */}
                {items.map((item, index) => (
                  <span
                    key={`second-${index}`}
                    className="inline-block mx-1 md:mx-2 px-2 md:px-3 py-0.5 md:py-1 border border-gray-300 dark:border-[#f6f6f4]/10 rounded-sm min-w-[120px] md:min-w-[140px] text-center font-normal flex-shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2520] transition-colors text-xs md:text-sm whitespace-nowrap"
                    style={{ fontWeight: 300 }}
                    title=""
                  >
                    {item}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
