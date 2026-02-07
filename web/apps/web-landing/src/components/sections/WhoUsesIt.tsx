'use client'

import React from 'react'

export default function WhoUsesIt() {
  const lines = [
    "Anything that runs AI.",
    "Applications",
    "Robots",
    "Autonomous systems",
    "Embedded devices",
    "Industrial machines",
    "Systems that cannot afford undefined behavior",
    "If it executes intelligence, it belongs on this layer."
  ]

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          <div className="py-16 md:py-24">
            <div className="max-w-3xl">
              <p className="text-lg md:text-xl lg:text-2xl font-inter mb-6 text-[#000000] dark:text-[#f6f6f4] leading-relaxed">
                {lines[0]}
              </p>
              <ul className="space-y-3 mb-6">
                {lines.slice(1, -1).map((line, index) => (
                  <li 
                    key={index}
                    className="text-base md:text-lg text-gray-600 dark:text-[#a8a898] font-inter ml-6 list-disc"
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <p className="text-lg md:text-xl lg:text-2xl font-inter text-[#000000] dark:text-[#f6f6f4] leading-relaxed italic">
                {lines[lines.length - 1]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
