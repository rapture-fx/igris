'use client'

import React from 'react'

export default function Solve() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r section-border flex items-center" style={{
          minHeight: '80px',
          borderTopWidth: '0',
          borderBottomWidth: '0'
        }}>
          <span className="text-xs md:text-sm lg:text-base font-inter text-[#000000] dark:text-[#f6f6f4]" style={{ fontWeight: 400 }}>
            The Challange We Solve : 
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Decision</span>
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Execution</span>
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Environment</span>
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Failure</span>
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Governance</span>
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Trust</span>
            <span className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right" style={{ fontWeight: 400 }}>Survival</span>
          </span>
        </div>
      </div>
    </section>
  )
}
