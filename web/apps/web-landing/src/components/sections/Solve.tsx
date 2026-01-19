'use client'

import React from 'react'

export default function Solve() {
  const items = [
    'Decision',
    'Execution',
    'Environment',
    'Failure',
    'Governance',
    'Trust',
    'Survival'
  ];

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 20s linear infinite;
        }
      `}</style>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r section-border flex items-center gap-4" style={{
          minHeight: '50px',
          borderTopWidth: '0',
          borderBottomWidth: '0'
        }}>
          {/* Static title */}
          <span className="text-xs md:text-sm lg:text-base font-inter font-normal text-[#000000] dark:text-[#f6f6f4] flex-shrink-0" style={{ fontWeight: 300 }}>
            The Challange We Solve :
          </span>

          {/* Scrolling container */}
          <div className="flex-1 overflow-hidden relative">
            <div className="flex animate-scroll">
              {/* First set of items */}
              {items.map((item, index) => (
                <span
                  key={`first-${index}`}
                  className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right font-normal flex-shrink-0"
                  style={{ fontWeight: 300 }}
                >
                  {item}
                </span>
              ))}
              {/* Duplicate set for seamless loop */}
              {items.map((item, index) => (
                <span
                  key={`second-${index}`}
                  className="inline-block mx-2 px-3 py-1 border border-gray-300 dark:border-[#f6f6f4]/5 w-[100px] text-right font-normal flex-shrink-0"
                  style={{ fontWeight: 300 }}
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
