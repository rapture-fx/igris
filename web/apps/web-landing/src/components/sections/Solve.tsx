'use client'

import React from 'react'
import Image from 'next/image'

export default function Solve() {
  const items = [
    'Remote',
    'Offline',
    'Scale',
    'Control',
    'Latency',
    'Cost',
    'Privacy'
  ];

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-gray-300 dark:border-[#f6f6f4]/5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 py-3 md:py-0" style={{
          minHeight: '50px',
          borderTopWidth: '0',
          borderBottomWidth: '0'
        }}>
          {/* Static title */}
          <span className="text-xs md:text-sm lg:text-base font-inter font-normal text-[#000000] dark:text-[#f6f6f4] flex-shrink-0" style={{ fontWeight: 300 }}>
            The Challange We Solve :
          </span>

          {/* Scrolling container */}
          <div className="flex-1 overflow-hidden relative scroll-container">
            <div className="flex animate-scroll-seamless" style={{ width: 'fit-content' }}>
              {/* First set of items */}
                {items.map((item, index) => (
                  <span
                    key={`first-${index}`}
                    className="inline-block mx-1 md:mx-2 px-2 md:px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[80px] md:w-[100px] text-center font-normal flex-shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2520] transition-colors text-xs md:text-sm"
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
                    className="inline-block mx-1 md:mx-2 px-2 md:px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[80px] md:w-[100px] text-center font-normal flex-shrink-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2520] transition-colors text-xs md:text-sm"
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
